begin;
alter table public.marketplace_fee_rules add column if not exists family_id smallint references public.product_families(id);
alter table public.marketplace_freight_rules add column if not exists max_order_value numeric(12,2);
-- Mercado Livre: comissão por família e tipo de anúncio; frete Cross abaixo de R$79 fixado nas regras de frete.
insert into public.marketplace_fee_rules(channel,family_id,listing_type,min_price,commission_percent,notes) values
 ('Mercado Livre',1,'classic',0,14,'Bebidas — anúncio Clássico'),('Mercado Livre',1,'premium',0,19,'Bebidas — anúncio Premium'),
 ('Mercado Livre',2,'classic',0,12,'Suplementos — anúncio Clássico'),('Mercado Livre',2,'premium',0,17,'Suplementos — anúncio Premium'),
 ('Mercado Livre',3,'classic',0,12,'Fertilizantes — anúncio Clássico'),('Mercado Livre',3,'premium',0,17,'Fertilizantes — anúncio Premium');
insert into public.marketplace_freight_rules(channel,family_id,max_weight_kg,max_order_value,freight_value,notes) values
 ('Mercado Livre',1,999,79,9.50,'Cross: abaixo de R$79,00 — tarifa fixa por unidade'),
 ('Mercado Livre',2,999,79,6.50,'Cross: abaixo de R$79,00 — tarifa fixa por unidade'),
 ('Mercado Livre',3,999,79,10.00,'Cross: abaixo de R$79,00 — tarifa fixa por unidade');
-- Shopee: comissão já inclui frete grátis; faixas e taxa fixa por item conforme tabela informada.
insert into public.marketplace_fee_rules(channel,family_id,listing_type,min_price,max_price,commission_percent,fixed_fee,notes)
select 'Shopee',f.id,'standard',v.min_price,v.max_price,v.commission,v.fixed_fee,v.notes
from public.product_families f cross join (values
 (0::numeric,79.99::numeric,20::numeric,4::numeric,'Até R$79,99'),
 (80::numeric,99.99::numeric,14::numeric,16::numeric,'De R$80,00 a R$99,99'),
 (100::numeric,199.99::numeric,14::numeric,20::numeric,'De R$100,00 a R$199,99'),
 (200::numeric,499.99::numeric,14::numeric,26::numeric,'De R$200,00 a R$499,99'),
 (500::numeric,null::numeric,14::numeric,28::numeric,'Acima de R$500,00')
) v(min_price,max_price,commission,fixed_fee,notes);
commit;
