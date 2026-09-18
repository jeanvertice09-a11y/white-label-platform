-- 0010_customers_marketing.sql — CRM básico e cupons por tenant/store.

-- ---------- CLIENTES ----------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  name text not null,
  phone text,
  email text,
  document text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id)
    on delete cascade,
  unique (tenant_id, store_id, id),
  constraint customers_phone_ck check (
    phone is null or phone ~ '^[0-9]{10,15}$'
  )
);

create unique index customers_store_phone_uidx
  on public.customers (tenant_id, store_id, phone)
  where phone is not null;
create index customers_store_name_idx
  on public.customers (tenant_id, store_id, lower(name));

alter table public.orders
  add column if not exists customer_id uuid;

alter table public.orders
  add constraint orders_customer_fk
    foreign key (tenant_id, store_id, customer_id)
    references public.customers (tenant_id, store_id, id)
    on delete set null (customer_id);

create index orders_customer_history_idx
  on public.orders (tenant_id, store_id, customer_id, created_at desc)
  where customer_id is not null;

-- ---------- CUPONS ----------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  code text not null,
  name text not null,
  active boolean not null default true,
  discount_type text not null,
  discount_value bigint not null,
  minimum_order_cents bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id)
    on delete cascade,
  unique (tenant_id, store_id, id),
  constraint coupons_code_ck check (
    code = upper(code)
    and code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'
  ),
  constraint coupons_discount_type_ck check (
    discount_type in ('percentage','fixed')
  ),
  constraint coupons_discount_value_ck check (
    (discount_type='percentage' and discount_value between 1 and 100)
    or (discount_type='fixed' and discount_value > 0)
  ),
  constraint coupons_minimum_ck check (
    minimum_order_cents is null or minimum_order_cents >= 0
  ),
  constraint coupons_period_ck check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),
  constraint coupons_usage_ck check (
    usage_limit is null or usage_limit > 0
  ),
  constraint coupons_usage_count_ck check (
    usage_count >= 0 and (usage_limit is null or usage_count <= usage_limit)
  )
);

create unique index coupons_store_code_uidx
  on public.coupons (tenant_id, store_id, code);
create index coupons_store_active_idx
  on public.coupons (tenant_id, store_id, active, starts_at, ends_at);

alter table public.orders
  add column if not exists coupon_id uuid,
  add column if not exists coupon_code_snapshot text;

alter table public.orders
  add constraint orders_coupon_fk
    foreign key (tenant_id, store_id, coupon_id)
    references public.coupons (tenant_id, store_id, id)
    on delete set null (coupon_id);

-- RLS deny-by-default; leitura/escrita operacional passa pelo server boundary.
alter table public.customers enable row level security;
alter table public.coupons enable row level security;
