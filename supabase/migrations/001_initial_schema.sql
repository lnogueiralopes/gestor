-- Ruta Direct Gestor Comercial - schema inicial
create extension if not exists "pgcrypto";

create type public.channel_type as enum ('mercadolivre','shopee','ruta_direct_shop');
create type public.listing_status as enum ('none','draft','active','paused','error','closed');
create type public.entity_type as enum ('product','kit');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  is_active boolean not null default true,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id bigserial primary key,
  code text unique not null,
  label text not null
);

create table public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_id bigint not null references public.permissions(id) on delete cascade,
  primary key (user_id, permission_id)
);

create table public.marketplace_accounts (
  id uuid primary key default gen_random_uuid(),
  channel public.channel_type not null,
  name text not null,
  external_account_id text,
  is_active boolean not null default true,
  credentials_ref text,
  created_at timestamptz not null default now()
);

create table public.user_marketplace_accounts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.marketplace_accounts(id) on delete cascade,
  primary key (user_id, account_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  reference text,
  ean text,
  origin text,
  winery text,
  brand text,
  vintage text,
  size text,
  varietal text,
  product_type text,
  name text not null,
  short_title text,
  summary text,
  description text,
  unit_cost numeric(14,2) not null default 0,
  target_margin numeric(8,4) not null default 0,
  stock_on_hand integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kits (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kit_items (
  kit_id uuid not null references public.kits(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  primary key (kit_id, product_id)
);

create table public.pricing_parameters (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null,
  value numeric(14,4) not null default 0,
  unit text not null check (unit in ('percent','currency','number')),
  scope text not null default 'global',
  channel public.channel_type,
  updated_at timestamptz not null default now()
);

create table public.kit_margin_rules (
  id uuid primary key default gen_random_uuid(),
  min_units integer not null,
  max_units integer not null,
  reduction_pp numeric(8,4) not null default 0,
  check (min_units > 0 and max_units >= min_units)
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  entity_type public.entity_type not null,
  product_id uuid references public.products(id),
  kit_id uuid references public.kits(id),
  account_id uuid not null references public.marketplace_accounts(id) on delete cascade,
  external_listing_id text,
  title text,
  price numeric(14,2),
  published_stock integer,
  status public.listing_status not null default 'none',
  external_url text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (entity_type='product' and product_id is not null and kit_id is null) or
    (entity_type='kit' and kit_id is not null and product_id is null)
  )
);

create unique index listings_product_account_unique
  on public.listings(product_id, account_id)
  where product_id is not null and external_listing_id is not null;

create unique index listings_kit_account_unique
  on public.listings(kit_id, account_id)
  where kit_id is not null and external_listing_id is not null;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  channel public.channel_type not null,
  account_id uuid references public.marketplace_accounts(id),
  external_order_id text,
  internal_order_number text unique,
  customer_name text,
  total numeric(14,2) not null default 0,
  payment_status text,
  order_status text,
  created_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  delta integer not null,
  reason text not null,
  order_id uuid references public.orders(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigserial primary key,
  user_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.marketplace_accounts(id),
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  result jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- View de disponibilidade dos kits: menor estoque possível entre componentes.
create or replace view public.kit_availability as
select
  k.id as kit_id,
  k.sku,
  k.name,
  coalesce(min(floor(p.stock_on_hand::numeric / ki.quantity)), 0)::integer as available_quantity
from public.kits k
join public.kit_items ki on ki.kit_id = k.id
join public.products p on p.id = ki.product_id
group by k.id, k.sku, k.name;

-- Permissões iniciais
insert into public.permissions(code,label) values
('products.view','Visualizar produtos'),
('products.edit','Editar produtos'),
('kits.edit','Criar e editar kits'),
('pricing.view','Visualizar precificador'),
('pricing.edit_margin','Editar margem por produto'),
('pricing.edit_parameters','Editar premissas do precificador'),
('pricing.publish','Enviar preços'),
('inventory.edit','Atualizar estoque'),
('listings.status','Pausar/ativar anúncios'),
('listings.create','Criar/publicar anúncios'),
('orders.view','Visualizar pedidos'),
('accounts.manage','Gerenciar contas'),
('users.manage','Administrar usuários')
on conflict (code) do nothing;

-- Parâmetros iniciais
insert into public.pricing_parameters(code,label,value,unit,scope) values
('tax_percent','Imposto',8,'percent','global'),
('packaging_per_unit','Embalagem por unidade',3.50,'currency','global'),
('operational_fixed','Custo operacional fixo',2.00,'currency','global'),
('safety_percent','Reserva / segurança',0,'percent','global')
on conflict (code) do nothing;

insert into public.kit_margin_rules(min_units,max_units,reduction_pp) values
(1,1,0),
(2,3,1),
(4,4,2),
(6,6,3)
on conflict do nothing;

-- Canais/contas iniciais de demonstração
insert into public.marketplace_accounts(channel,name,is_active) values
('mercadolivre','ML Principal',true),
('shopee','Shopee Principal',true),
('ruta_direct_shop','Ruta Direct Shop',true);

-- RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.kits enable row level security;
alter table public.kit_items enable row level security;
alter table public.marketplace_accounts enable row level security;
alter table public.user_marketplace_accounts enable row level security;
alter table public.listings enable row level security;
alter table public.pricing_parameters enable row level security;
alter table public.kit_margin_rules enable row level security;
alter table public.orders enable row level security;

create policy "authenticated can read products" on public.products for select to authenticated using (true);
create policy "authenticated can read kits" on public.kits for select to authenticated using (true);
create policy "authenticated can read kit items" on public.kit_items for select to authenticated using (true);
create policy "authenticated can read pricing" on public.pricing_parameters for select to authenticated using (true);
create policy "authenticated can read kit rules" on public.kit_margin_rules for select to authenticated using (true);

create policy "users see own profile" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "users see allowed accounts" on public.marketplace_accounts
for select to authenticated using (
  exists (
    select 1 from public.user_marketplace_accounts uma
    where uma.account_id = marketplace_accounts.id and uma.user_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  )
);

create policy "users see allowed listings" on public.listings
for select to authenticated using (
  exists (
    select 1 from public.user_marketplace_accounts uma
    where uma.account_id = listings.account_id and uma.user_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  )
);

-- IMPORTANTE:
-- Escritas sensíveis devem passar pelo Worker, usando Service Role + checagem de permissão.
