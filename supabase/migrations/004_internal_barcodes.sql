-- Company-internal RCN-13, prefix 04. These are not globally assigned GTINs.
begin;
create sequence private.internal_ean_sequence as bigint minvalue 1 maxvalue 9999999999 no cycle;
create sequence private.kitmix_sequence as bigint minvalue 1 maxvalue 9999999999 no cycle;

-- Shared across products AND kits. Retired codes remain reserved permanently.
create table private.barcode_registry (
  code text primary key,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  is_internal boolean not null,
  created_at timestamptz not null default now()
);
create table private.kitmix_registry (
  sku text primary key,
  kit_id uuid unique not null
);
revoke all on private.barcode_registry, private.kitmix_registry from public, anon, authenticated;
revoke all on sequence private.internal_ean_sequence, private.kitmix_sequence from public, anon, authenticated;
alter table private.barcode_registry enable row level security;
alter table private.kitmix_registry enable row level security;

create function private.ean13_check_digit(payload text) returns text
language plpgsql immutable strict set search_path = '' as $$
declare total integer := 0; i integer;
begin
  if payload !~ '^[0-9]{12}$' then raise exception 'Base EAN deve ter 12 dígitos.'; end if;
  for i in 1..12 loop
    total := total + substring(payload from i for 1)::integer * case when i % 2 = 0 then 3 else 1 end;
  end loop;
  return ((10 - total % 10) % 10)::text;
end $$;
revoke all on function private.ean13_check_digit(text) from public;

create function private.reserve_barcode(kind public.entity_type, owner_id uuid, requested text) returns text
language plpgsql security definer set search_path = '' as $$
declare candidate text; payload text; existing private.barcode_registry%rowtype;
begin
  candidate := nullif(btrim(requested), '');
  if candidate is not null then
    if candidate !~ '^[0-9]+$' then raise exception 'EAN deve conter somente dígitos.'; end if;
    if left(candidate,2) = '04' and
      (length(candidate) <> 13 or right(candidate,1) <> private.ean13_check_digit(left(candidate,12))) then
      raise exception 'Código interno deve ter estrutura EAN-13 e dígito verificador correto.';
    end if;
    insert into private.barcode_registry(code,entity_type,entity_id,is_internal)
      values(candidate,kind,owner_id,left(candidate,2) = '04') on conflict do nothing;
    select * into existing from private.barcode_registry where code = candidate;
    if existing.entity_type <> kind or existing.entity_id <> owner_id then
      raise exception 'Código EAN já reservado para outro produto ou kit: %', candidate using errcode = '23505';
    end if;
    return candidate;
  end if;
  loop
    payload := '04' || lpad(nextval('private.internal_ean_sequence')::text,10,'0');
    candidate := payload || private.ean13_check_digit(payload);
    insert into private.barcode_registry(code,entity_type,entity_id,is_internal)
      values(candidate,kind,owner_id,true) on conflict do nothing;
    if found then return candidate; end if;
  end loop;
end $$;
revoke all on function private.reserve_barcode(public.entity_type,uuid,text) from public;

alter table public.products add column ean_is_internal boolean not null default false;
alter table public.kits add column ean text;
alter table public.kits add column ean_is_internal boolean not null default true;

create or replace function private.product_sku_from_ean() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and nullif(btrim(new.ean),'') is null then new.ean := old.ean; end if;
  new.ean := private.reserve_barcode('product',new.id,new.ean);
  new.sku := new.ean;
  select is_internal into new.ean_is_internal from private.barcode_registry where code = new.ean;
  return new;
end $$;
drop trigger product_sku_from_ean on public.products;
create trigger product_sku_from_ean before insert or update on public.products
for each row execute function private.product_sku_from_ean();

create function private.kit_barcode() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and nullif(btrim(new.ean),'') is null then new.ean := old.ean; end if;
  new.ean := private.reserve_barcode('kit',new.id,new.ean);
  select is_internal into new.ean_is_internal from private.barcode_registry where code = new.ean;
  -- The final SKU is assigned at commit after the complete composition is present.
  if nullif(btrim(new.sku),'') is null then new.sku := '__draft_' || new.id::text; end if;
  return new;
end $$;
revoke all on function private.kit_barcode() from public;
create trigger kit_barcode before insert or update on public.kits
for each row execute function private.kit_barcode();

create function private.reserve_kitmix(owner_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare candidate text; seq_text text;
begin
  select sku into candidate from private.kitmix_registry where kit_id = owner_id;
  if found then return candidate; end if;
  loop
    seq_text := nextval('private.kitmix_sequence')::text;
    candidate := 'kitmix_' || lpad(seq_text,greatest(5,length(seq_text)),'0');
    -- Preserve existing manually assigned values by skipping them.
    if exists(select 1 from public.kits where sku = candidate and id <> owner_id) then continue; end if;
    insert into private.kitmix_registry(sku,kit_id) values(candidate,owner_id) on conflict do nothing;
    if found then return candidate; end if;
    select sku into candidate from private.kitmix_registry where kit_id = owner_id;
    if found then return candidate; end if;
  end loop;
end $$;
revoke all on function private.reserve_kitmix(uuid) from public;

create or replace function private.refresh_kit_sku(target_kit uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare expected_sku text; component_count integer;
begin
  perform id from public.kits where id = target_kit for update;
  if not found then return; end if;
  select count(*), min(p.ean) || '_x' || min(ki.quantity)::text
    into component_count, expected_sku
  from public.kit_items ki join public.products p on p.id = ki.product_id where ki.kit_id = target_kit;
  if component_count > 1 then expected_sku := private.reserve_kitmix(target_kit);
  elsif component_count = 0 then return; -- Drafts are not yet mixed or homogeneous.
  end if;
  if expected_sku is not null then
    update public.kits set sku = expected_sku where id = target_kit and sku is distinct from expected_sku;
  end if;
end $$;

-- Reserve all supplied codes before generating any codes, so imports cannot collide.
insert into private.barcode_registry(code,entity_type,entity_id,is_internal)
select ean,'product',id,left(ean,2) = '04' from public.products where ean is not null;
-- There was no kit EAN column before this migration.
update public.products set ean = ean;
update public.kits set ean = ean;
set constraints all immediate;
alter table public.products alter column ean set not null;
alter table public.kits alter column ean set not null;
create unique index kits_ean_unique on public.kits(ean);
create unique index products_ean_unique on public.products(ean);
comment on column public.products.ean_is_internal is 'Internal RCN-13. Never send as an official marketplace GTIN.';
comment on column public.kits.ean_is_internal is 'Internal RCN-13. Never send as an official marketplace GTIN.';
commit;
