begin;
create table if not exists public.marketplace_fee_rules (
 id uuid primary key default gen_random_uuid(), channel text not null, listing_type text not null default 'standard',
 min_price numeric(12,2) not null default 0, max_price numeric(12,2), commission_percent numeric(8,4) not null default 0,
 fixed_fee numeric(12,2) not null default 0, active boolean not null default true, notes text not null default '',
 created_at timestamptz not null default now()
);
create table if not exists public.marketplace_freight_rules (
 id uuid primary key default gen_random_uuid(), channel text not null, family_id smallint references public.product_families(id),
 max_weight_kg numeric(10,3) not null, max_volume_cm3 numeric(14,2), freight_value numeric(12,2) not null default 0,
 active boolean not null default true, notes text not null default '', created_at timestamptz not null default now()
);
create index if not exists marketplace_fee_rules_lookup on public.marketplace_fee_rules(channel,listing_type,min_price);
create index if not exists marketplace_freight_rules_lookup on public.marketplace_freight_rules(channel,family_id,max_weight_kg);
alter table public.marketplace_fee_rules enable row level security;
alter table public.marketplace_freight_rules enable row level security;
grant select on public.marketplace_fee_rules, public.marketplace_freight_rules to authenticated;
grant insert,update,delete on public.marketplace_fee_rules, public.marketplace_freight_rules to authenticated;
create policy fee_rules_read on public.marketplace_fee_rules for select to authenticated using (private.has_permission('pricing.view'));
create policy fee_rules_write on public.marketplace_fee_rules for all to authenticated using (private.has_permission('pricing.edit')) with check (private.has_permission('pricing.edit'));
create policy freight_rules_read on public.marketplace_freight_rules for select to authenticated using (private.has_permission('pricing.view'));
create policy freight_rules_write on public.marketplace_freight_rules for all to authenticated using (private.has_permission('pricing.edit')) with check (private.has_permission('pricing.edit'));
insert into public.permissions(code,label) values ('pricing.tariffs.edit','Atualizar tarifas e fretes') on conflict(code) do nothing;
commit;
