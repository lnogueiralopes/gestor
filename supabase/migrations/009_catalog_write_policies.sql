-- Admins with the catalog permission may maintain products and kits.
insert into public.permissions(code,label) values ('products.edit','Editar produtos e kits') on conflict (code) do nothing;
grant insert (ean,sku,name,origin,winery,brand,vintage,size,varietal,product_type,short_title,summary,description,unit_cost,target_margin,stock_on_hand,image_1_url,image_2_url,image_3_url,image_4_url,image_5_url,image_6_url),
  update (ean,name,origin,winery,brand,vintage,size,varietal,product_type,short_title,summary,description,unit_cost,target_margin,stock_on_hand,image_1_url,image_2_url,image_3_url,image_4_url,image_5_url,image_6_url) on public.products to authenticated;
grant usage on sequence private.product_identifier_sequence to authenticated;
grant update (sku) on public.products to authenticated;
create policy products_admin_insert on public.products for insert to authenticated
  with check (private.has_permission('products.edit'));
create policy products_admin_update on public.products for update to authenticated
  using (private.has_permission('products.edit'))
  with check (private.has_permission('products.edit'));
create policy kits_admin_insert on public.kits for insert to authenticated
  with check (private.has_permission('products.edit'));
create policy kits_admin_update on public.kits for update to authenticated
  using (private.has_permission('products.edit'))
  with check (private.has_permission('products.edit'));

