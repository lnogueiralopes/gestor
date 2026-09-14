begin;
alter table public.marketplace_freight_rules add column if not exists package_units integer;
alter table public.marketplace_freight_rules add column if not exists width_cm numeric(10,2);
alter table public.marketplace_freight_rules add column if not exists length_cm numeric(10,2);
alter table public.marketplace_freight_rules add column if not exists height_cm numeric(10,2);
alter table public.marketplace_freight_rules add column if not exists estimated_volume_cm3 numeric(14,2);
insert into public.marketplace_freight_rules(channel,family_id,package_units,max_weight_kg,width_cm,length_cm,height_cm,estimated_volume_cm3,freight_value,notes)
values
 ('Mercado Livre',1,2,2.6,7.6,15.2,30,3465.6,0,'Grade compacta 1x2 para 2 garrafas'),
 ('Mercado Livre',1,3,3.9,7.6,22.8,30,5198.4,0,'Grade compacta 1x3 para 3 garrafas'),
 ('Mercado Livre',1,4,5.2,15.2,15.2,30,6931.2,0,'Grade compacta 2x2 para 4 garrafas'),
 ('Mercado Livre',1,6,7.8,15.2,22.8,30,10396.8,0,'Grade compacta 2x3 para 6 garrafas'),
 ('Shopee',1,2,2.6,7.6,15.2,30,3465.6,0,'Grade compacta 1x2 para 2 garrafas'),
 ('Shopee',1,3,3.9,7.6,22.8,30,5198.4,0,'Grade compacta 1x3 para 3 garrafas'),
 ('Shopee',1,4,5.2,15.2,15.2,30,6931.2,0,'Grade compacta 2x2 para 4 garrafas'),
 ('Shopee',1,6,7.8,15.2,22.8,30,10396.8,0,'Grade compacta 2x3 para 6 garrafas');
commit;
