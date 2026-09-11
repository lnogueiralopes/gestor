-- Human-facing sequential identifiers for catalog records.
begin;

alter table public.products rename column reference to id_produto;
alter table public.products alter column id_produto type integer using null::integer;
with numbered as (
  select id, row_number() over (order by ean, id)::integer as number from public.products
)
update public.products p set id_produto = numbered.number from numbered where p.id = numbered.id;
set constraints all immediate;
alter table public.products alter column id_produto set not null;
alter table public.products add constraint products_id_produto_positive check (id_produto > 0);
create unique index products_id_produto_unique on public.products(id_produto);
create sequence private.product_identifier_sequence as integer minvalue 1 no cycle;
select setval('private.product_identifier_sequence', greatest(coalesce(max(id_produto),0),1), count(*)>0) from public.products;
alter table public.products alter column id_produto set default nextval('private.product_identifier_sequence');

create sequence private.kit_identifier_sequence as integer minvalue 1 maxvalue 2147483647 no cycle;
alter table public.kits add column id_kit integer;
with numbered as (
  select id, row_number() over (order by created_at, id)::integer as number from public.kits
)
update public.kits k set id_kit = numbered.number from numbered where k.id = numbered.id;
set constraints all immediate;
select setval('private.kit_identifier_sequence', greatest(coalesce(max(id_kit),0),1), count(*)>0) from public.kits;
alter table public.kits alter column id_kit set default nextval('private.kit_identifier_sequence');
alter table public.kits alter column id_kit set not null;
alter table public.kits add constraint kits_id_kit_positive check (id_kit > 0);
create unique index kits_id_kit_unique on public.kits(id_kit);

comment on column public.products.id_produto is 'Identificador sequencial do produto, separado do SKU e do EAN.';
comment on column public.kits.id_kit is 'Identificador sequencial do kit, separado do SKU e do EAN.';
commit;

