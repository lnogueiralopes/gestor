-- Apply after 001. Browser access is read-only; writes await authenticated Worker endpoints.
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active);
$$;

create function private.has_permission(required_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
    and (p.is_admin or exists(
      select 1 from public.user_permissions up
      join public.permissions permission on permission.id = up.permission_id
      where up.user_id = p.id and permission.code = required_code
    ))
  );
$$;

create function private.can_access_account(target_account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
    and (p.is_admin or exists(
      select 1 from public.user_marketplace_accounts uma
      where uma.user_id = p.id and uma.account_id = target_account
    ))
  );
$$;

revoke all on function private.is_active_user() from public;
revoke all on function private.has_permission(text) from public;
revoke all on function private.can_access_account(uuid) from public;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.can_access_account(uuid) to authenticated;

-- Cover every application table, including permissions, queues and audit data.
do $$
declare t text;
begin
  foreach t in array array['profiles','permissions','user_permissions','marketplace_accounts',
    'user_marketplace_accounts','products','kits','kit_items','pricing_parameters',
    'kit_margin_rules','listings','orders','inventory_movements','audit_logs','sync_jobs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

drop policy "authenticated can read products" on public.products;
drop policy "authenticated can read kits" on public.kits;
drop policy "authenticated can read kit items" on public.kit_items;
drop policy "authenticated can read pricing" on public.pricing_parameters;
drop policy "authenticated can read kit rules" on public.kit_margin_rules;
drop policy "users see own profile" on public.profiles;
drop policy "users see allowed accounts" on public.marketplace_accounts;
drop policy "users see allowed listings" on public.listings;

create policy products_read on public.products for select to authenticated
  using (private.has_permission('products.view'));
create policy kits_read on public.kits for select to authenticated
  using (private.has_permission('products.view'));
create policy kit_items_read on public.kit_items for select to authenticated
  using (private.has_permission('products.view'));
create policy pricing_read on public.pricing_parameters for select to authenticated
  using (private.has_permission('pricing.view'));
create policy kit_rules_read on public.kit_margin_rules for select to authenticated
  using (private.has_permission('pricing.view'));
create policy profile_read on public.profiles for select to authenticated
  using (private.is_active_user() and (id = auth.uid() or private.has_permission('users.manage')));
create policy permissions_read on public.permissions for select to authenticated
  using (private.is_active_user());
create policy user_permissions_read on public.user_permissions for select to authenticated
  using (private.is_active_user() and (user_id = auth.uid() or private.has_permission('users.manage')));
create policy account_assignments_read on public.user_marketplace_accounts for select to authenticated
  using (private.is_active_user() and (user_id = auth.uid() or private.has_permission('users.manage')));
create policy accounts_read on public.marketplace_accounts for select to authenticated
  using (private.can_access_account(id));
create policy listings_read on public.listings for select to authenticated
  using (private.can_access_account(account_id) and private.has_permission('products.view'));
create policy orders_read on public.orders for select to authenticated
  using (private.can_access_account(account_id) and private.has_permission('orders.view'));

-- No browser policies for audit_logs, sync_jobs or inventory_movements yet.
-- Views must obey the caller's RLS, rather than the migration owner's privileges.
alter view public.kit_availability set (security_invoker = true);
revoke all on public.kit_availability from anon, authenticated;
grant select on public.kit_availability to authenticated;

-- Prevent duplicate drafts as well as duplicate published listings.
drop index public.listings_product_account_unique;
drop index public.listings_kit_account_unique;
create unique index listings_product_account_unique on public.listings(product_id, account_id)
  where product_id is not null;
create unique index listings_kit_account_unique on public.listings(kit_id, account_id)
  where kit_id is not null;

commit;
