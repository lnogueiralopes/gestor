begin;
insert into public.permissions(code,label) values
 ('costs.edit.family.1','Alterar custos — Bebidas'),
 ('costs.edit.family.2','Alterar custos — Suplementos'),
 ('costs.edit.family.3','Alterar custos — Fertilizantes')
on conflict (code) do update set label=excluded.label;

create or replace function private.can_edit_product_family(target_family_id smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
      and (p.is_admin or exists(
        select 1 from public.user_permissions up
        join public.permissions permission on permission.id = up.permission_id
        where up.user_id=p.id and permission.code='products.edit'
      ) and exists(
        select 1 from public.user_permissions up
        join public.permissions permission on permission.id = up.permission_id
        where up.user_id=p.id and permission.code='costs.edit.family.'||target_family_id::text
      ))
  );
$$;
grant execute on function private.can_edit_product_family(smallint) to authenticated;
drop policy if exists products_admin_update on public.products;
create policy products_admin_update on public.products for update to authenticated
  using (private.can_edit_product_family(family_id))
  with check (private.can_edit_product_family(family_id));
commit;

