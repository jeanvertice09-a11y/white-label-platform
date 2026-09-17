-- 0001_foundation.sql — fundação multi-tenant (PLATFORM -> TENANT -> STORE -> RESOURCE)
-- Invariante: PostgreSQL rejeita tenant A + store do tenant B via FK composta.

create extension if not exists "pgcrypto";

-- ---------- TENANTS ----------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  status text not null default 'trial' check (status in ('trial','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
create unique index tenants_slug_uidx on public.tenants (slug);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('tenant_owner','tenant_admin','tenant_finance','tenant_support')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index tenant_members_user_idx on public.tenant_members (user_id);

create table public.platform_members (
  user_id uuid primary key,
  role text not null check (role in ('platform_owner','platform_admin','platform_support','platform_finance')),
  created_at timestamptz not null default now()
);

create table public.tenant_branding (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  logo_url text,
  primary_color text,
  created_at timestamptz not null default now()
);

create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- STORES ----------
-- UNIQUE(tenant_id, id) existe PARA a FK composta dos recursos filhos.
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, slug)
);

create table public.store_members (
  tenant_id uuid not null,
  store_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('store_owner','store_admin','store_manager','store_staff')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);
create index store_members_user_idx on public.store_members (user_id);
create index store_members_tenant_idx on public.store_members (tenant_id);

create table public.store_settings (
  tenant_id uuid not null,
  store_id uuid not null,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (store_id),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

-- ---------- DOMAINS ----------
create table public.domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  store_id uuid,
  hostname text not null,
  type text not null check (type in ('tenant_panel','tenant_site','store_admin','store_catalog')),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  verification_token text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  -- Quando store_id presente, o par (tenant_id, store_id) deve existir em stores:
  -- garante que domínio do tenant A nunca aponte para store do tenant B.
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);
-- Hostname globalmente único quando ativo: índice parcial.
create unique index domains_hostname_active_uidx on public.domains (hostname) where (status = 'active');

-- ---------- AUDIT ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  tenant_id uuid references public.tenants (id) on delete set null,
  store_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text,
  request_id text,
  ip text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_tenant_idx on public.audit_logs (tenant_id, created_at desc);
create index audit_logs_store_idx on public.audit_logs (store_id, created_at desc);
