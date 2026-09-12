begin;
create table if not exists public.ml_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verifier text not null,
  expires_at timestamptz not null
);
create table if not exists public.ml_connections (
  seller_id text primary key,
  connected_by uuid not null references auth.users(id),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.ml_oauth_states enable row level security;
alter table public.ml_connections enable row level security;
revoke all on public.ml_oauth_states, public.ml_connections from public, anon, authenticated;
grant all on public.ml_oauth_states, public.ml_connections to service_role;
commit;
