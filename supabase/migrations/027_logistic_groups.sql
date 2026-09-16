begin;

-- Evolve the existing model registry; historical calculation JSON stays immutable.
alter table public.pricing_logistic_models
 add column group_key text unique,
 add column group_number bigint generated always as identity,
 add column volume_liters numeric generated always as (floor(width_cm*length_cm*height_cm/100)/10) stored,
 add column freight_origin text not null default 'pending' check(freight_origin in ('pending','api','manual')),
 add column freight_updated_at timestamptz,
 add column freight_revision integer not null default 0,
 add column quote_price numeric(14,2) check(quote_price>0),
 add column quote_listing_type text not null default 'gold_special' check(quote_listing_type in ('gold_special','gold_pro')),
 add column quote_logistic_type text not null default 'drop_off',
 add column pending_quote jsonb,
 add column accepted_quote jsonb,
 add column pending_quote_at timestamptz;

create function public.pricing_logistic_key(family smallint,units integer,weight numeric,width numeric,length numeric,height numeric)
returns text language sql immutable strict set search_path='' as $$
 -- User-defined 0.1 L band: 1372 cm³ -> 1.3 L (truncate, do not round up).
 select jsonb_build_array('Mercado Livre',family,units,weight::numeric(10,3),floor(width*length*height/100))::text
$$;

-- Reuse one existing equivalent model; do not delete duplicate legacy references.
with ranked as (
 select id,public.pricing_logistic_key(family_id,package_units,weight_kg,width_cm,length_cm,height_cm) k,
 row_number() over(partition by public.pricing_logistic_key(family_id,package_units,weight_kg,width_cm,length_cm,height_cm) order by confirmed_at desc nulls last,id) n
 from public.pricing_logistic_models where channel='Mercado Livre' and weight_kg>0 and width_cm>0 and length_cm>0 and height_cm>0
)
update public.pricing_logistic_models m set group_key=r.k from ranked r where m.id=r.id and r.n=1;
update public.pricing_logistic_models set freight_origin='manual',freight_updated_at=confirmed_at where confirmed_at is not null and freight_net_value is not null;

create function public.ensure_product_logistic_group() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.family_id is not null and new.weight_kg>0 and new.width_cm>0 and new.length_cm>0 and new.height_cm>0 then
 insert into public.pricing_logistic_models(channel,family_id,package_units,name,weight_kg,width_cm,length_cm,height_cm,group_key)
 values('Mercado Livre',new.family_id,1,'Unidade',new.weight_kg,new.width_cm,new.length_cm,new.height_cm,
 public.pricing_logistic_key(new.family_id,1,new.weight_kg,new.width_cm,new.length_cm,new.height_cm)) on conflict(group_key) do nothing;
 end if;
 return new;
end $$;
create trigger products_logistic_group after insert or update of family_id,weight_kg,width_cm,length_cm,height_cm on public.products
for each row execute function public.ensure_product_logistic_group();
insert into public.pricing_logistic_models(channel,family_id,package_units,name,weight_kg,width_cm,length_cm,height_cm,group_key)
select distinct 'Mercado Livre',family_id,1,'Unidade',weight_kg,width_cm,length_cm,height_cm,
public.pricing_logistic_key(family_id,1,weight_kg,width_cm,length_cm,height_cm)
from public.products where family_id is not null and weight_kg>0 and width_cm>0 and length_cm>0 and height_cm>0
on conflict(group_key) do nothing;

-- Explicitly validated operational premise: unit bottle, 1.1 kg, 1.3 L band.
-- No update to 2–6 unit models, other weights or other volume bands.
insert into public.pricing_logistic_models(channel,family_id,package_units,name,weight_kg,width_cm,length_cm,height_cm,group_key)
select 'Mercado Livre',id,1,'Garrafa unitária',1.1,7,7,28,public.pricing_logistic_key(id,1,1.1,7,7,28)
from public.product_families where id=1 on conflict(group_key) do nothing;
update public.pricing_logistic_models set freight_net_value=22.50,freight_table_value=22.50,
 freight_discount_percent=0,freight_discount_value=0,freight_origin='manual',confirmed_at=now(),freight_updated_at=now(),freight_revision=freight_revision+1
where group_key=public.pricing_logistic_key(1::smallint,1,1.1,7,7,28);

create view public.pricing_product_logistic_groups with(security_invoker=true) as
select p.id product_id,m.id group_id from public.products p
left join public.pricing_logistic_models m on m.group_key=public.pricing_logistic_key(p.family_id,1,p.weight_kg,p.width_cm,p.length_cm,p.height_cm)
where p.is_active;
grant select on public.pricing_product_logistic_groups to authenticated,service_role;
grant usage,select on sequence public.pricing_logistic_models_group_number_seq to authenticated,service_role;

-- Only the explicit save/accept action validates a freight value. Revision guards
-- prevent a response to an older quote from replacing a more recent manual edit.
create function public.save_group_freight(p_group uuid,p_revision integer,p_value numeric,p_accept_quote boolean default false)
returns public.pricing_logistic_models language plpgsql security invoker set search_path='' as $$
declare g public.pricing_logistic_models; value numeric;
begin
 if not private.has_permission('pricing.edit') then raise exception 'Sem permissão para editar fretes'; end if;
 select * into g from public.pricing_logistic_models where id=p_group for update;
 if not found or g.freight_revision<>p_revision then raise exception 'O grupo mudou. Atualize a tabela antes de salvar.'; end if;
 value:=case when p_accept_quote then (g.pending_quote->>'freight_net_value')::numeric else p_value end;
 if value is null or value<0 then raise exception 'Frete inválido'; end if;
 if p_accept_quote and g.pending_quote is null then raise exception 'Não existe cotação pendente'; end if;
 update public.pricing_logistic_models set freight_net_value=value,
 freight_table_value=case when p_accept_quote then (g.pending_quote->>'freight_table_value')::numeric else value end,
 freight_discount_percent=case when p_accept_quote then (g.pending_quote->>'freight_discount_percent')::numeric else 0 end,
 freight_discount_value=case when p_accept_quote then (g.pending_quote->>'freight_discount_value')::numeric else 0 end,
 freight_origin=case when p_accept_quote then 'api' else 'manual' end,
 accepted_quote=case when p_accept_quote then g.pending_quote else null end,
 confirmed_at=now(),freight_updated_at=now(),freight_revision=freight_revision+1
 where id=p_group returning * into g;
 return g;
end $$;
revoke all on function public.save_group_freight(uuid,integer,numeric,boolean) from public;
grant execute on function public.save_group_freight(uuid,integer,numeric,boolean) to authenticated;
commit;
