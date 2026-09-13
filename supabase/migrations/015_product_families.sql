begin;
create table if not exists public.product_families (
 id smallint primary key, name text not null unique, icon text not null,
 registration_rules jsonb not null default '{}'::jsonb,
 pricing_rules jsonb not null default '{}'::jsonb,
 kit_rules jsonb not null default '{}'::jsonb,
 content_rules jsonb not null default '{}'::jsonb
);
insert into public.product_families(id,name,icon,registration_rules,pricing_rules,kit_rules,content_rules) values
 (1,'Bebidas','bottle','{"status":"existing"}','{"status":"existing"}','{"status":"existing"}','{"status":"existing"}'),
 (2,'Suplementos','capsule','{"status":"pending"}','{"status":"pending"}','{"status":"pending"}','{"status":"pending"}'),
 (3,'Fertilizantes','sprout','{"status":"pending"}','{"status":"pending"}','{"status":"pending"}','{"status":"pending"}')
on conflict(id) do nothing;
alter table public.products add column if not exists family_id smallint not null default 1 references public.product_families(id);
alter table public.product_families enable row level security;
revoke all on public.product_families from anon,authenticated;
grant select on public.product_families to authenticated;
grant all on public.product_families to service_role;
drop policy if exists product_families_read on public.product_families;
create policy product_families_read on public.product_families for select to authenticated using (private.is_active_user());
comment on column public.products.family_id is 'Família de premissas; independente da categoria e do tipo do produto.';
commit;
