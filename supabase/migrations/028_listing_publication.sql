begin;
-- Preserve account -> one pricing table. Link OAuth sellers to real account IDs.
create function private.ensure_ml_marketplace_account() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.marketplace_accounts where channel='mercadolivre' and external_account_id=new.seller_id) then
  insert into public.marketplace_accounts(channel,name,external_account_id)
  values('mercadolivre','Mercado Livre '||new.seller_id,new.seller_id);
 end if;
 return new;
end $$;
create trigger ml_connection_account after insert on public.ml_connections
for each row execute function private.ensure_ml_marketplace_account();
insert into public.marketplace_accounts(channel,name,external_account_id)
select 'mercadolivre','Mercado Livre '||c.seller_id,c.seller_id from public.ml_connections c
where not exists(select 1 from public.marketplace_accounts a where a.channel='mercadolivre' and a.external_account_id=c.seller_id);

alter table public.listings
 add column listing_type text check(listing_type in ('classic','premium')),
 add column pricing_table_id uuid references public.pricing_tables(id),
 add column calculation_id uuid references public.pricing_calculations(id),
 add column category_id text,
 add column user_product_id text,
 add column publication_state text not null default 'draft' check(publication_state in ('draft','validated','publishing','published','error','uncertain')),
 add column publication_payload jsonb,
 add column publication_context jsonb,
 add column validation_result jsonb,
 add column validated_at timestamptz,
 add column requested_by uuid references auth.users(id);
drop index public.listings_product_account_unique;
create unique index listings_product_account_unique on public.listings(product_id,account_id,coalesce(listing_type,'legacy')) where product_id is not null;
create unique index listings_external_account_unique on public.listings(account_id,external_listing_id) where external_listing_id is not null;
-- Only the server can reserve and publish. Browser remains read-only for listings.
grant all on public.listings,public.marketplace_accounts,public.pricing_account_settings to service_role;
comment on column public.listings.publication_state is 'publishing/uncertain are never automatically retried: reconcile external result first to avoid duplicate active listings.';
commit;
