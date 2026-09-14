begin;
create table if not exists public.pricing_tables (
 id uuid primary key default gen_random_uuid(), channel text not null, name text not null,
 rule_type text not null default 'standard', adjustment_percent numeric(8,4) not null default 0,
 description text not null default '', created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 unique(channel,name)
);
create table if not exists public.pricing_account_settings (
 account_id uuid primary key references public.marketplace_accounts(id) on delete cascade,
 pricing_table_id uuid not null references public.pricing_tables(id), updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.pricing_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), action text not null,
 affected_count integer not null default 0, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
insert into public.pricing_tables(channel,name,rule_type,adjustment_percent,description) values
 ('Mercado Livre','Preço normal','standard',0,'Preço calculado com custo, margem e premissas.'),
 ('Mercado Livre','Campanha +10%','discount_buffer',10,'Gordura para compensar desconto de 10% e preservar o resultado.'),
 ('Shopee','Preço normal','standard',0,'Preço calculado com custo, margem e premissas.'),
 ('Shopee','Campanha +10%','discount_buffer',10,'Gordura para compensar desconto de 10% e preservar o resultado.')
on conflict(channel,name) do nothing;
alter table public.pricing_tables enable row level security;
alter table public.pricing_account_settings enable row level security;
alter table public.pricing_logs enable row level security;
grant select,insert,update on public.pricing_tables to authenticated;
grant select,insert,update on public.pricing_account_settings to authenticated;
grant select,insert on public.pricing_logs to authenticated;
create policy pricing_tables_read on public.pricing_tables for select to authenticated using (private.has_permission('pricing.view'));
create policy pricing_tables_write on public.pricing_tables for all to authenticated using (private.has_permission('pricing.edit')) with check (private.has_permission('pricing.edit'));
create policy pricing_account_settings_access on public.pricing_account_settings for all to authenticated using (private.is_active_user()) with check (private.is_active_user());
create policy pricing_logs_read on public.pricing_logs for select to authenticated using (private.has_permission('pricing.view'));
create policy pricing_logs_insert on public.pricing_logs for insert to authenticated with check (user_id=auth.uid() or private.has_permission('users.manage'));
insert into public.permissions(code,label) values ('pricing.edit','Editar tabelas e parâmetros de preço') on conflict(code) do nothing;
commit;
