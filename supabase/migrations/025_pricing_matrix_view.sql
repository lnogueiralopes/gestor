begin;
create or replace view public.pricing_product_matrix as
select p.id,p.ean,p.sku,p.name,p.family_id,f.name as family_name,
 p.unit_cost,p.target_margin,p.width_cm,p.length_cm,p.height_cm,p.weight_kg,p.volume_cm3,
 t.id as pricing_table_id,t.channel,t.name as pricing_table_name,t.adjustment_percent,
 coalesce(fee.commission_percent,0) as commission_percent,coalesce(fee.fixed_fee,0) as commission_fixed_fee,
 coalesce(fr.freight_value,0) as freight_value,
 round(((p.unit_cost * (1 + p.target_margin / 100) * (1 / greatest(0.01,1 - t.adjustment_percent / 100))) + coalesce(fr.freight_value,0) + coalesce(fee.fixed_fee,0)) /
   greatest(0.01,1 - coalesce(fee.commission_percent,0) / 100),2) as calculated_price
from public.products p
join public.product_families f on f.id=p.family_id
cross join public.pricing_tables t
left join lateral (select r.commission_percent,r.fixed_fee from public.marketplace_fee_rules r where r.channel=t.channel and (r.family_id=p.family_id or r.family_id is null) and r.active and p.unit_cost*(1+p.target_margin/100) between r.min_price and coalesce(r.max_price,999999999) order by r.family_id nulls last,r.min_price desc limit 1) fee on true
left join lateral (select r.freight_value from public.marketplace_freight_rules r where r.channel=t.channel and r.family_id=p.family_id and r.active and r.max_weight_kg>=p.weight_kg order by r.max_weight_kg limit 1) fr on true
where p.is_active;
alter view public.pricing_product_matrix set (security_invoker = true);
grant select on public.pricing_product_matrix to authenticated;
commit;

