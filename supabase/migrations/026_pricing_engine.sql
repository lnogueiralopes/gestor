-- Additive preparation for the TypeScript solver. No marketplace publication.
begin;

alter table public.pricing_tables
 add column discount_percent numeric(8,4) not null default 0 check (discount_percent >= 0 and discount_percent < 100),
 add column additional_commission_percent numeric(8,4) not null default 0 check (additional_commission_percent >= 0 and additional_commission_percent < 100),
 add column markup_percent numeric(8,4) not null default 0 check (markup_percent >= 0),
 add column additional_fixed_cost numeric(14,2) not null default 0 check (additional_fixed_cost >= 0),
 add constraint pricing_tables_id_channel_key unique (id,channel);
-- Only the known campaign has an unambiguous mapping. Custom legacy rules need review.
update public.pricing_tables set discount_percent=10
 where channel in ('Mercado Livre','Shopee') and name='Campanha +10%'
 and rule_type='discount_buffer' and adjustment_percent=10;
comment on column public.pricing_tables.adjustment_percent is 'Legacy only; engine uses explicit composition columns.';
comment on column public.pricing_tables.markup_percent is 'Commercial uplift applied after solving the target; re-evaluate all price bands after uplift and discount.';

-- Reuse the parameter registry introduced in 001. Zero is provisional, not a real tax assumption.
alter table public.pricing_parameters add column confirmed_at timestamptz;
insert into public.pricing_parameters(code,label,value,unit,scope) values
 ('tax_percent','Imposto',0,'percent','global'),
 ('safety_reserve_percent','Reserva de segurança',0,'percent','global'),
 ('operational_cost','Custo operacional por venda',0,'currency','global')
on conflict(code) do nothing;
alter table public.pricing_parameters add constraint pricing_engine_parameters_valid check (
 code not in ('tax_percent','safety_reserve_percent','operational_cost') or
 (scope='global' and channel is null and value>=0 and
 ((code='operational_cost' and unit='currency') or
 (code='safety_reserve_percent' and unit='percent') or
 (code='tax_percent' and unit='percent' and value<100))));
grant insert,update on public.pricing_parameters to authenticated;
create policy pricing_engine_parameters_write on public.pricing_parameters for all to authenticated
 using (private.has_permission('pricing.edit')) with check (private.has_permission('pricing.edit'));

create table public.pricing_family_parameters (
 family_id smallint primary key references public.product_families(id),
 packaging_unit_cost numeric(14,2) not null default 0 check (packaging_unit_cost>=0)
);
insert into public.pricing_family_parameters(family_id) select id from public.product_families;
-- A missing future-family row also means zero in the engine input view below.

-- Preserve legacy rule rows and the old matrix until the application switches engines.
alter table public.marketplace_freight_rules add column engine_kind text not null default 'freight'
 check (engine_kind in ('freight','fixed_fee','package_model'));
update public.marketplace_freight_rules set engine_kind='package_model'
 where package_units is not null and freight_value=0;
update public.marketplace_freight_rules set engine_kind='fixed_fee'
 where channel='Mercado Livre' and package_units is null
 and notes like 'Cross: abaixo de R$79,00 — tarifa fixa por unidade%';

create table public.pricing_fixed_fee_rules (
 id uuid primary key default gen_random_uuid(), channel text not null,
 family_id smallint references public.product_families(id),
 min_price numeric(14,2) not null default 0 check(min_price>=0),
 max_price_exclusive numeric(14,2), fixed_fee numeric(14,2) not null check(fixed_fee>=0),
 per_unit boolean not null default true, active boolean not null default true,
 source_rule_id uuid unique references public.marketplace_freight_rules(id),
 confirmed_at timestamptz,
 check(max_price_exclusive is null or max_price_exclusive>min_price)
);
insert into public.pricing_fixed_fee_rules(channel,family_id,max_price_exclusive,fixed_fee,active,source_rule_id)
 select channel,family_id,max_order_value,freight_value,active,id
 from public.marketplace_freight_rules where engine_kind='fixed_fee';

-- Independent global Shopee copies: no family-specific rule is discarded.
-- Divergent active rules cannot be silently consolidated.
do $$ begin
 if exists(select 1 from public.marketplace_fee_rules where channel='Shopee' and active
 group by min_price,max_price having count(distinct (commission_percent,fixed_fee))>1) then
 raise exception 'Conflicting Shopee rules: reconcile family/global values before migration 026';
 end if;
end $$;
insert into public.marketplace_fee_rules(channel,family_id,listing_type,min_price,max_price,commission_percent,fixed_fee,notes)
 select distinct r.channel,null::smallint,'standard',r.min_price,r.max_price,r.commission_percent,r.fixed_fee,'026: consolidated global Shopee premise; confirm before use'
 from public.marketplace_fee_rules r where r.channel='Shopee' and r.active
 and not exists(select 1 from public.marketplace_fee_rules g where g.channel='Shopee' and g.family_id is null and g.active
 and g.min_price=r.min_price and g.max_price is not distinct from r.max_price);
create view public.pricing_engine_fee_rules with (security_invoker=true) as
 select * from public.marketplace_fee_rules where active and
 ((channel='Mercado Livre' and family_id is not null and listing_type in ('classic','premium'))
 or (channel='Shopee' and family_id is null and listing_type='standard'));
create view public.pricing_engine_freight_rules with (security_invoker=true) as
 select * from public.marketplace_freight_rules where active and engine_kind='freight';

create table public.pricing_logistic_models (
 id uuid primary key default gen_random_uuid(), channel text not null,
 family_id smallint not null references public.product_families(id),
 package_units integer not null check(package_units>0), family_signature text,
 name text not null, weight_kg numeric(10,3) check(weight_kg>0),
 width_cm numeric(10,2) check(width_cm>0), length_cm numeric(10,2) check(length_cm>0), height_cm numeric(10,2) check(height_cm>0),
 cubic_weight_kg numeric(10,3) check(cubic_weight_kg>0),
 freight_table_value numeric(14,2) check(freight_table_value>=0),
 freight_discount_percent numeric(8,4) check(freight_discount_percent between 0 and 100),
 freight_discount_value numeric(14,2) check(freight_discount_value>=0),
 freight_net_value numeric(14,2) check(freight_net_value>=0),
 confirmed_at timestamptz, source_rule_id uuid unique references public.marketplace_freight_rules(id),
 check(confirmed_at is null or (weight_kg is not null and width_cm is not null and length_cm is not null and height_cm is not null and freight_net_value is not null))
);
insert into public.pricing_logistic_models(channel,family_id,package_units,family_signature,name,weight_kg,width_cm,length_cm,height_cm,source_rule_id)
 select channel,family_id,package_units,family_signature,notes,max_weight_kg,width_cm,length_cm,height_cm,id
 from public.marketplace_freight_rules where engine_kind='package_model' and family_id is not null;
insert into public.pricing_logistic_models(channel,family_id,package_units,name)
 select 'Mercado Livre',1,n,'Bebidas × '||n||' — medidas e frete pendentes'
 from (values(1),(5)) v(n) where exists(select 1 from public.product_families where id=1);
comment on table public.pricing_logistic_models is 'Unconfirmed models are estimates; NULL freight is unknown, never free shipping. Preserve all model values in each snapshot.';

-- Immutable history; current results are selected by sequence, never overwritten.
create table public.pricing_calculations (
 id uuid primary key default gen_random_uuid(), revision bigint generated always as identity unique,
 product_id uuid not null references public.products(id),
 pricing_table_id uuid not null, channel text not null,
 listing_type text, calculated_price numeric(14,2) not null check(calculated_price>=0),
 effective_price numeric(14,2) not null check(effective_price>=0),
 target_result numeric(14,4) not null, calculated_result numeric(14,4) not null,
 calculation_details jsonb not null, engine_version text not null,
 calculated_by uuid references auth.users(id), calculated_at timestamptz not null default now(),
 foreign key(pricing_table_id,channel) references public.pricing_tables(id,channel),
 check((channel='Mercado Livre' and listing_type is not null and listing_type in ('classic','premium')) or (channel='Shopee' and listing_type is null)),
 check(calculated_result>=target_result)
);
create index pricing_calculations_lookup on public.pricing_calculations(product_id,pricing_table_id,channel,listing_type,revision desc);

create function public.validate_pricing_snapshot() returns trigger language plpgsql set search_path='' as $$
declare k text; d jsonb:=new.calculation_details;
begin
 if tg_op<>'INSERT' then raise exception 'Pricing snapshots are immutable'; end if;
 if jsonb_typeof(d) is distinct from 'object' then raise exception 'Snapshot must be an object'; end if;
 foreach k in array array['quantity','original_unit_cost','original_cost','target_margin_percent','safety_reserve_percent','safety_reserve_value','adjusted_cost','packaging_unit_cost','packaging_total','operational_cost','tax_percent','tax_value','commission_percent','commission_value','fixed_fee','freight_value','discount_percent','discount_value','additional_commission_percent','additional_commission_value','markup_percent','markup_value','additional_fixed_cost','other_costs','announced_price','effective_price','target_result','calculated_result'] loop
 if jsonb_typeof(d->k) is distinct from 'number' then raise exception 'Missing/nonnumeric snapshot field: %',k; end if;
 end loop;
 if (d->>'quantity')::numeric<=0 or (d->>'quantity')::numeric<>trunc((d->>'quantity')::numeric) then raise exception 'Invalid quantity'; end if;
 if not(d ?& array['product','family','pricing_table','global_parameters','fee_rules','fixed_fee_rules','logistics']) then raise exception 'Missing source snapshots'; end if;
 foreach k in array array['product','family','pricing_table','global_parameters'] loop
 if jsonb_typeof(d->k) is distinct from 'object' then raise exception 'Missing source object: %',k; end if;
 end loop;
 if not((d->'global_parameters') ?& array['tax_percent','safety_reserve_percent','operational_cost']) then raise exception 'Missing principal global costs'; end if;
 if new.channel='Mercado Livre' and jsonb_typeof(d->'logistics') is distinct from 'object' then raise exception 'Mercado Livre requires a freight quote before pricing'; end if;
 foreach k in array array['fee_rules','fixed_fee_rules'] loop
 if jsonb_typeof(d->k) is distinct from 'array' then raise exception 'Missing source array: %',k; end if;
 end loop;
 if (d->>'freight_value')::numeric<>0 or d->'logistics'<>'null'::jsonb then
 if jsonb_typeof(d->'logistics') is distinct from 'object' then raise exception 'Missing logistics snapshot'; end if;
 foreach k in array array['weight_kg','width_cm','length_cm','height_cm','freight_table_value','freight_discount_percent','freight_discount_value','freight_net_value'] loop
 if jsonb_typeof(d->'logistics'->k) is distinct from 'number' then raise exception 'Missing logistics value: %',k; end if;
 end loop;
 if not((d->'logistics') ?& array['model','cubic_weight_kg','source']) then raise exception 'Missing logistics provenance'; end if;
 end if;
 if new.calculated_price<>(d->>'announced_price')::numeric or new.effective_price<>(d->>'effective_price')::numeric
 or new.target_result<>(d->>'target_result')::numeric or new.calculated_result<>(d->>'calculated_result')::numeric then raise exception 'Snapshot/result mismatch'; end if;
 if abs(new.target_result-(d->>'original_cost')::numeric*(d->>'target_margin_percent')::numeric/100)>0.0001 then raise exception 'Target must use original cost'; end if;
 if abs((d->>'original_cost')::numeric-(d->>'original_unit_cost')::numeric*(d->>'quantity')::numeric)>0.0001 then raise exception 'Original cost mismatch'; end if;
 if abs((d->>'adjusted_cost')::numeric-(d->>'original_cost')::numeric*(1+(d->>'safety_reserve_percent')::numeric/100))>0.0001 then raise exception 'Adjusted cost mismatch'; end if;
 if abs((d->>'packaging_total')::numeric-(d->>'packaging_unit_cost')::numeric*(d->>'quantity')::numeric)>0.0001 then raise exception 'Packaging mismatch'; end if;
 if new.effective_price<>round(new.calculated_price*(1-(d->>'discount_percent')::numeric/100),2) then raise exception 'Effective price mismatch'; end if;
 if abs(new.calculated_result-(new.effective_price-(d->>'tax_value')::numeric-(d->>'commission_value')::numeric-(d->>'additional_commission_value')::numeric-(d->>'fixed_fee')::numeric-(d->>'freight_value')::numeric-(d->>'adjusted_cost')::numeric-(d->>'packaging_total')::numeric-(d->>'operational_cost')::numeric-(d->>'additional_fixed_cost')::numeric-(d->>'other_costs')::numeric))>0.0001 then raise exception 'Net result mismatch'; end if;
 return new;
end $$;
create trigger pricing_snapshot_guard before insert or update or delete on public.pricing_calculations for each row execute function public.validate_pricing_snapshot();

create view public.pricing_current_calculations with(security_invoker=true) as
 select distinct on(product_id,pricing_table_id,channel,listing_type) * from public.pricing_calculations
 order by product_id,pricing_table_id,channel,listing_type,revision desc;
create view public.pricing_engine_matrix with(security_invoker=true) as
 select p.id as product_id,p.family_id,t.id as pricing_table_id,t.channel,t.name as pricing_table_name,m.listing_type,
 coalesce(fp.packaging_unit_cost,0) as packaging_unit_cost,c.id as calculation_id,
 c.calculated_price,c.effective_price,c.target_result,c.calculated_result,c.calculation_details,c.calculated_at
 from public.products p cross join public.pricing_tables t
 cross join lateral (select 'classic'::text listing_type where t.channel='Mercado Livre'
 union all select 'premium' where t.channel='Mercado Livre'
 union all select null::text where t.channel='Shopee') m
 left join public.pricing_family_parameters fp on fp.family_id=p.family_id
 left join public.pricing_current_calculations c on c.product_id=p.id and c.pricing_table_id=t.id and c.channel=t.channel and c.listing_type is not distinct from m.listing_type
 where p.is_active;

create table public.pricing_freight_observations (
 id uuid primary key default gen_random_uuid(), calculation_id uuid not null references public.pricing_calculations(id),
 external_order_reference text not null, account_id uuid not null references public.marketplace_accounts(id),
 actual_freight numeric(14,2) not null check(actual_freight>=0), observed_at timestamptz not null default now(),
 unique(account_id,external_order_reference,calculation_id)
);

create table public.pricing_recalculation_requests (
 id uuid primary key default gen_random_uuid(), reason text not null check(reason in ('costs','parameters','pricing_tables','dimensions','freight_rules','manual_all')),
 scope jsonb not null default '{}'::jsonb, status text not null default 'pending' check(status in ('pending','running','completed','failed')),
 requested_by uuid references auth.users(id), requested_at timestamptz not null default now(), completed_at timestamptz, error_message text
);
create index pricing_recalculation_pending on public.pricing_recalculation_requests(status,requested_at);
create or replace function public.queue_pricing_recalculation() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.pricing_recalculation_requests(reason,scope) values (TG_ARGV[0],jsonb_build_object('table',TG_TABLE_NAME,'operation',TG_OP)); return new; end $$;
create trigger products_pricing_dirty after update of unit_cost,target_margin on public.products for each statement execute function public.queue_pricing_recalculation('costs');
create trigger products_dimensions_pricing_dirty after update of width_cm,length_cm,height_cm,weight_kg on public.products for each statement execute function public.queue_pricing_recalculation('dimensions');
create trigger parameters_pricing_dirty after insert or update or delete on public.pricing_parameters for each statement execute function public.queue_pricing_recalculation('parameters');
create trigger family_parameters_pricing_dirty after insert or update or delete on public.pricing_family_parameters for each statement execute function public.queue_pricing_recalculation('parameters');
create trigger tables_pricing_dirty after insert or update or delete on public.pricing_tables for each statement execute function public.queue_pricing_recalculation('pricing_tables');
create trigger freight_pricing_dirty after insert or update or delete on public.marketplace_freight_rules for each statement execute function public.queue_pricing_recalculation('freight_rules');

do $$ declare t text; begin
 foreach t in array array['pricing_family_parameters','pricing_fixed_fee_rules','pricing_logistic_models','pricing_calculations','pricing_freight_observations','pricing_recalculation_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy engine_read on public.%I for select to authenticated using (private.has_permission(''pricing.view''))',t);
 execute format('create policy engine_insert on public.%I for insert to authenticated with check (private.has_permission(''pricing.edit''))',t);
 if t<>'pricing_calculations' then
 execute format('grant update on public.%I to authenticated',t);
 execute format('create policy engine_update on public.%I for update to authenticated using(private.has_permission(''pricing.edit'')) with check(private.has_permission(''pricing.edit''))',t);
 end if;
 end loop;
end $$;
grant usage,select on sequence public.pricing_calculations_revision_seq to authenticated,service_role;
grant select on public.pricing_engine_fee_rules,public.pricing_engine_freight_rules,public.pricing_current_calculations,public.pricing_engine_matrix to authenticated,service_role;
comment on view public.pricing_engine_matrix is 'New solver matrix: ML classic/premium, Shopee NULL. NULL prices mean not calculated. Legacy pricing_product_matrix remains unchanged for compatibility.';
comment on view public.pricing_product_matrix is 'Deprecated by 026. Do not use in the renewed precificador; use pricing_engine_matrix and the TypeScript solver.';
commit;

