begin;
alter table public.products add column if not exists quantity_per_box integer not null default 1;
alter table public.products drop constraint if exists products_quantity_per_box_check;
alter table public.products add constraint products_quantity_per_box_check check (quantity_per_box > 0);
grant insert (quantity_per_box), update (quantity_per_box) on public.products to authenticated;
commit;
