insert into public.products
(sku, reference, ean, origin, winery, brand, vintage, size, varietal, product_type, name, unit_cost, target_margin, stock_on_hand)
values
('VIN001','REF001','7790000000011','Argentina','Catena Zapata','Catena','2024','750ml','Malbec','Vinho','Catena Malbec 750ml',70,30,30),
('VIN002','REF002','7790000000028','Argentina','Rutini Wines','Rutini','2023','750ml','Malbec','Vinho','Rutini Malbec 750ml',82,28,12),
('VIN003','REF003','7790000000035','Argentina','Alamos','Alamos','2024','750ml','Malbec','Vinho','Alamos Malbec 750ml',55,25,18)
on conflict (sku) do nothing;

insert into public.kits(sku,name,description) values
('KIT001','Kit 2 Catena Malbec','Kit com 2 unidades de Catena Malbec'),
('KIT002','Kit 3 Catena Malbec','Kit com 3 unidades de Catena Malbec'),
('KIT003','Trio Argentina','Kit misto com três rótulos')
on conflict (sku) do nothing;

insert into public.kit_items(kit_id, product_id, quantity)
select k.id, p.id, 2 from public.kits k, public.products p where k.sku='KIT001' and p.sku='VIN001'
on conflict do nothing;

insert into public.kit_items(kit_id, product_id, quantity)
select k.id, p.id, 3 from public.kits k, public.products p where k.sku='KIT002' and p.sku='VIN001'
on conflict do nothing;

insert into public.kit_items(kit_id, product_id, quantity)
select k.id, p.id, 1 from public.kits k, public.products p where k.sku='KIT003' and p.sku in ('VIN001','VIN002','VIN003')
on conflict do nothing;
