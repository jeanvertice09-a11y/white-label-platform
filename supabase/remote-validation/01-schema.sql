-- ============================================================
-- SCHEMA COMPLETO — white-label-platform
-- Aplicar em ordem: 0001 -> 0002 -> 0003 -> 0004 -> 0005
-- Compatível com projeto Supabase NOVO e VAZIO (PostgreSQL + pgcrypto)
-- ============================================================

-- ============================================================
-- 0001_foundation.sql — fundação multi-tenant
-- ============================================================

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

-- ============================================================
-- 0002_commerce_stubs.sql — esqueletos tenant/store-scoped
-- ============================================================

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

-- ============================================================
-- 0003_rls.sql — RLS deny-by-default + membership via auth.uid()
-- ============================================================

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.platform_members enable row level security;
alter table public.tenant_branding enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_settings enable row level security;
alter table public.domains enable row level security;
alter table public.audit_logs enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.media_assets enable row level security;
alter table public.subscriptions enable row level security;
alter table public.gateway_accounts enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;

-- Helpers SECURITY DEFINER mínimos (2 funções, com proteções).
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = p_tenant_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.store_members m
    where m.store_id = p_store_id and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.is_store_member(uuid) from public;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.is_store_member(uuid) to authenticated;

-- Sem políticas permissivas = deny-by-default. Adicionamos leitura por membership:
create policy tenants_member_read on public.tenants
  for select to authenticated using (public.is_tenant_member(id));

create policy stores_member_read on public.stores
  for select to authenticated using (public.is_store_member(id));

create policy products_member_read on public.products
  for select to authenticated using (public.is_store_member(store_id));

create policy orders_member_read on public.orders
  for select to authenticated using (public.is_store_member(store_id));

-- Escrita: apenas via service_role em server/worker (sem policy p/ authenticated = negado).
-- Catálogo público: endpoint dedicado com DomainResolver + query tenant-scoped.

-- ============================================================
-- 0004_composite_hardening.sql — integridade composta
-- ============================================================

-- ============ CATÁLOGO: alvos únicos p/ FKs compostas ============
alter table public.categories
  add constraint categories_tenant_store_id_uidx unique (tenant_id, store_id, id);

alter table public.products
  add constraint products_tenant_store_id_uidx unique (tenant_id, store_id, id);

alter table public.orders
  add constraint orders_tenant_store_id_uidx unique (tenant_id, store_id, id);

-- products.category_id: simples -> composta (categoria da mesma store).
alter table public.products
  drop constraint if exists products_category_id_fkey,
  add constraint products_category_fk
    foreign key (tenant_id, store_id, category_id)
    references public.categories (tenant_id, store_id, id)
    on delete set null;

-- order_items.order_id / product_id: compostas.
alter table public.order_items
  drop constraint if exists order_items_order_id_fkey,
  drop constraint if exists order_items_product_id_fkey,
  add constraint order_items_order_fk
    foreign key (tenant_id, store_id, order_id)
    references public.orders (tenant_id, store_id, id)
    on delete cascade,
  add constraint order_items_product_fk
    foreign key (tenant_id, store_id, product_id)
    references public.products (tenant_id, store_id, id)
    on delete set null;

-- stock_movements.product_id: composta.
alter table public.stock_movements
  drop constraint if exists stock_movements_product_id_fkey,
  add constraint stock_movements_product_fk
    foreign key (tenant_id, store_id, product_id)
    references public.products (tenant_id, store_id, id)
    on delete set null;

-- ============ DOMAINS: coerência tipo/escopo + hostname ============
alter table public.domains
  add constraint domains_scope_ck check (
    (type in ('store_admin', 'store_catalog') and store_id is not null)
    or (type in ('tenant_panel', 'tenant_site') and store_id is null)
  ),
  add constraint domains_hostname_ck check (
    hostname = lower(hostname)
    and hostname not like '% %'
    and hostname not like '%:%'
    and hostname not like '%/%'
    and hostname not like '%?%'
  ),
  add constraint domains_verified_ck check (
    status <> 'active' or verified_at is not null
  );

-- ============ AUDIT / MÍDIA ============
alter table public.audit_logs
  add constraint audit_logs_store_fk
    foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id)
    on delete set null,
  add constraint audit_logs_scope_ck check (
    store_id is null or tenant_id is not null
  );

alter table public.media_assets
  add constraint media_assets_store_fk
    foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id)
    on delete cascade;

-- ============ BILLING: subscriptions tenant-scoped ============
-- Assinaturas SaaS vivem no nível tenant (platform/tenant billing).
-- Cobrança por lojista usa payments com level=tenant_billing.
alter table public.subscriptions
  drop column if exists store_id,
  alter column tenant_id set not null;

-- ============ GATEWAY ACCOUNTS: escopo por nível ============
alter table public.gateway_accounts
  add constraint gateway_accounts_scope_ck check (
    (level = 'platform_billing' and tenant_id is null and store_id is null)
    or (level = 'tenant_billing' and tenant_id is not null and store_id is null)
    or (level = 'store_checkout' and tenant_id is not null and store_id is not null)
  ),
  add constraint gateway_accounts_store_fk
    foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id)
    on delete cascade,
  add constraint gateway_accounts_level_id_uidx unique (level, id),
  add constraint gateway_accounts_tenant_store_id_uidx unique (tenant_id, store_id, id);

-- ============ PAYMENTS: nível + gateway do mesmo escopo ============
alter table public.payments
  add constraint payments_scope_ck check (
    (level = 'platform_billing' and tenant_id is not null and store_id is null)
    or (level = 'tenant_billing' and tenant_id is not null and store_id is null)
    or (level = 'store_checkout' and tenant_id is not null and store_id is not null)
  ),
  -- gateway sempre do mesmo nível (sempre aplicável: sem NULLs).
  add constraint payments_gateway_level_fk
    foreign key (level, gateway_account_id)
    references public.gateway_accounts (level, id),
  -- gateway da mesma store (aplicável a store_checkout).
  add constraint payments_gateway_store_fk
    foreign key (tenant_id, store_id, gateway_account_id)
    references public.gateway_accounts (tenant_id, store_id, id);

-- Propriedade de tenant p/ platform/tenant billing (FKs condicionais não
-- existem): trigger dedicado. Escritas ocorrem via service_role (RLS já
-- nega authenticated), então o SELECT interno funciona.
create or replace function public.enforce_payment_gateway_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  g_level text;
  g_tenant uuid;
  g_store uuid;
begin
  select ga.level, ga.tenant_id, ga.store_id
    into g_level, g_tenant, g_store
  from public.gateway_accounts ga
  where ga.id = NEW.gateway_account_id;
  if not found then
    raise exception 'payments: gateway_account inexistente';
  end if;
  if g_level is distinct from NEW.level then
    raise exception 'payments: level do payment (%) diverge do gateway (%)', NEW.level, g_level;
  end if;
  if NEW.level = 'platform_billing' then
    if g_tenant is not null or g_store is not null then
      raise exception 'payments: platform_billing exige gateway da plataforma';
    end if;
  elsif NEW.level = 'tenant_billing' then
    if g_tenant is distinct from NEW.tenant_id or g_store is not null then
      raise exception 'payments: tenant_billing exige gateway do mesmo tenant';
    end if;
  else
    if g_tenant is distinct from NEW.tenant_id or g_store is distinct from NEW.store_id then
      raise exception 'payments: store_checkout exige gateway da mesma store';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists payments_gateway_scope_trg on public.payments;
create trigger payments_gateway_scope_trg
  before insert or update on public.payments
  for each row execute function public.enforce_payment_gateway_scope();

-- ============================================================
-- 0005_membership_self_read.sql — leitura da PRÓPRIA membership
-- ============================================================

-- Sem recursão: policies comparam coluna direta com auth.uid(),
-- sem subconsulta na mesma tabela. Servidor continua usando service_role;
-- clientes autenticados precisam ler as próprias memberships p/ UX (menus,
-- seleção de tenant/store). Nenhuma escrita liberada.
create policy tenant_members_self_read on public.tenant_members
  for select to authenticated using (user_id = auth.uid());

create policy store_members_self_read on public.store_members
  for select to authenticated using (user_id = auth.uid());

create policy platform_members_self_read on public.platform_members
  for select to authenticated using (user_id = auth.uid());