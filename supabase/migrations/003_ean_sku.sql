-- EAN stays text so leading zeroes are preserved. UUID relationships do not change.
begin;

create function private.product_sku_from_ean() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.ean := nullif(btrim(new.ean), '');
  if new.ean is not null then
    if new.ean !~ '^[0-9]+$' then
      raise exception 'EAN deve conter somente dígitos.';
    end if;
    new.sku := new.ean;
  end if;
  return new;
end $$;
revoke all on function private.product_sku_from_ean() from public;
create trigger product_sku_from_ean before insert or update of ean, sku
on public.products for each row execute function private.product_sku_from_ean();

-- Normalize existing products, without deleting records on a SKU conflict.
update public.products set ean = ean where nullif(btrim(ean), '') is not null;

create function private.refresh_kit_sku(target_kit uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare expected_sku text;
begin
  -- Serialize composition changes for this kit before reading its final state.
  perform id from public.kits where id = target_kit for update;
  select min(p.ean) || '_x' || min(ki.quantity)::text into expected_sku
  from public.kit_items ki join public.products p on p.id = ki.product_id
  where ki.kit_id = target_kit
  having count(*) = 1 and count(p.ean) = 1;
  if expected_sku is not null then
    update public.kits set sku = expected_sku
    where id = target_kit and sku is distinct from expected_sku;
  end if;
end $$;
revoke all on function private.refresh_kit_sku(uuid) from public;

create function private.sync_kit_sku() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target_kit uuid;
begin
  if tg_table_name = 'kit_items' then
    if tg_op <> 'INSERT' then perform private.refresh_kit_sku(old.kit_id); end if;
    if tg_op <> 'DELETE' then perform private.refresh_kit_sku(new.kit_id); end if;
  elsif tg_table_name = 'kits' then
    perform private.refresh_kit_sku(new.id);
  else
    for target_kit in select kit_id from public.kit_items where product_id = new.id loop
      perform private.refresh_kit_sku(target_kit);
    end loop;
  end if;
  return null;
end $$;
revoke all on function private.sync_kit_sku() from public;

-- Deferred until commit: a mixed kit must not become a single-product kit midway
-- through a multi-row composition insert. Future CRUD must save composition atomically.
create constraint trigger kit_items_sku after insert or update or delete on public.kit_items
deferrable initially deferred for each row execute function private.sync_kit_sku();
create constraint trigger kits_sku after insert or update on public.kits
deferrable initially deferred for each row execute function private.sync_kit_sku();
create constraint trigger product_kit_sku after update on public.products
deferrable initially deferred for each row execute function private.sync_kit_sku();

do $$
declare target_kit uuid;
begin
  for target_kit in select id from public.kits loop
    perform private.refresh_kit_sku(target_kit);
  end loop;
end $$;
commit;
