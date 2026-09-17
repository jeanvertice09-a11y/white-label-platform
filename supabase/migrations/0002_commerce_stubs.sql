-- 0002_commerce_stubs.sql — esqueletos tenant/store-scoped para fases futuras.
-- Todos usam FK composta (tenant_id, store_id) -> stores(tenant_id, id).

-- ---------- CATÁLOGO ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  slug text not null,
  name text not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade,
  unique (tenant_id, store_id, slug)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  category_id uuid references public.categories (id) on delete set null,
  slug text not null,
  name text not null,
  price_cents bigint not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade,
  unique (tenant_id, store_id, slug)
);
create index products_store_idx on public.products (tenant_id, store_id, active);

-- ---------- PEDIDOS ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  status text not null default 'pending',
  total_cents bigint not null check (total_cents >= 0),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  qty integer not null check (qty > 0),
  unit_cents bigint not null check (unit_cents >= 0),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  product_id uuid references public.products (id) on delete set null,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

-- ---------- MÍDIA ----------
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid,
  object_key text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

-- ---------- BILLING / PAGAMENTOS ----------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  price_cents bigint not null check (price_cents >= 0)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('platform_billing','tenant_billing')),
  tenant_id uuid references public.tenants (id) on delete cascade,
  store_id uuid,
  plan_id uuid references public.plans (id),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.gateway_accounts (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('platform_billing','tenant_billing','store_checkout')),
  tenant_id uuid references public.tenants (id) on delete cascade,
  store_id uuid,
  provider text not null check (provider in ('mercadopago','asaas')),
  label text not null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('platform_billing','tenant_billing','store_checkout')),
  tenant_id uuid not null,
  store_id uuid,
  gateway_account_id uuid not null references public.gateway_accounts (id),
  provider_payment_id text,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  gateway_account_id uuid references public.gateway_accounts (id) on delete set null,
  external_event_id text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  created_at timestamptz not null default now(),
  unique (provider, gateway_account_id, external_event_id)
);
