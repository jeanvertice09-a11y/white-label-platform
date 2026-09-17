-- 0007_catalog_storefront.sql — catálogo público + administração da loja.
-- Escopo: STORE. Toda relação carrega tenant_id + store_id para impedir
-- referência cruzada entre White Labels/lojas.
--
-- IMPORTANTE:
-- - leitura pública continua passando pelo servidor + DomainResolver;
-- - RLS não libera acesso anônimo direto às tabelas;
-- - escrita autenticada continua negada por padrão (service_role no servidor).

-- ============ CATEGORIAS ============
alter table public.categories
  add column if not exists parent_id uuid,
  add column if not exists active boolean not null default true,
  add column if not exists position integer not null default 0 check (position >= 0),
  add column if not exists updated_at timestamptz not null default now();

alter table public.categories
  add constraint categories_parent_not_self_ck
    check (parent_id is null or parent_id <> id),
  add constraint categories_parent_fk
    foreign key (tenant_id, store_id, parent_id)
    references public.categories (tenant_id, store_id, id)
    on delete set null (parent_id);

create index if not exists categories_public_idx
  on public.categories (tenant_id, store_id, active, position, name);

-- ============ PRODUTOS ============
alter table public.products
  add column if not exists description text not null default '',
  add column if not exists sku text,
  add column if not exists cost_cents bigint check (cost_cents is null or cost_cents >= 0),
  add column if not exists compare_at_price_cents bigint
    check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  add column if not exists track_inventory boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists products_store_sku_uidx
  on public.products (tenant_id, store_id, sku)
  where sku is not null;

create index if not exists products_public_sort_idx
  on public.products (tenant_id, store_id, active, created_at desc, id desc);

-- ============ VARIANTES ============
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  product_id uuid not null,
  name text not null,
  sku text,
  attributes jsonb not null default '{}'::jsonb,
  price_cents bigint not null check (price_cents >= 0),
  compare_at_price_cents bigint
    check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  cost_cents bigint check (cost_cents is null or cost_cents >= 0),
  active boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_product_fk
    foreign key (tenant_id, store_id, product_id)
    references public.products (tenant_id, store_id, id)
    on delete cascade,
  constraint product_variants_scope_uidx
    unique (tenant_id, store_id, product_id, id)
);

create unique index product_variants_store_sku_uidx
  on public.product_variants (tenant_id, store_id, sku)
  where sku is not null;

create index product_variants_product_idx
  on public.product_variants (tenant_id, store_id, product_id, active, position);

-- ============ IMAGENS DE PRODUTO ============
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  product_id uuid not null,
  object_key text not null,
  alt_text text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  constraint product_images_product_fk
    foreign key (tenant_id, store_id, product_id)
    references public.products (tenant_id, store_id, id)
    on delete cascade,
  constraint product_images_object_uidx
    unique (tenant_id, store_id, object_key)
);

create index product_images_product_idx
  on public.product_images (tenant_id, store_id, product_id, position);

-- ============ CONFIGURAÇÃO DO CATÁLOGO ============
create table public.catalog_settings (
  tenant_id uuid not null,
  store_id uuid primary key,
  layout text not null default 'classic'
    check (layout in ('classic', 'modern')),
  primary_color text not null default '#111111'
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#111111'
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text not null default '#ffffff'
    check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  font_key text not null default 'system'
    check (font_key in ('system','inter','manrope','poppins','montserrat','playfair')),
  show_search boolean not null default true,
  show_categories boolean not null default true,
  show_stock boolean not null default false,
  show_prices boolean not null default true,
  checkout_mode text not null default 'whatsapp'
    check (checkout_mode in ('whatsapp','online','both')),
  whatsapp_phone text,
  whatsapp_message_template text not null default
    'Olá! Gostaria de fazer este pedido:',
  currency text not null default 'BRL' check (currency = 'BRL'),
  seo_title text,
  seo_description text,
  labels jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint catalog_settings_store_fk
    foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id)
    on delete cascade,
  constraint catalog_settings_whatsapp_ck check (
    whatsapp_phone is null or whatsapp_phone ~ '^\\+[1-9][0-9]{7,14}$'
  )
);

-- ============ BANNERS ============
create table public.catalog_banners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  object_key text not null,
  title text,
  subtitle text,
  link_url text,
  active boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_banners_store_fk
    foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id)
    on delete cascade,
  constraint catalog_banners_object_uidx
    unique (tenant_id, store_id, object_key)
);

create index catalog_banners_public_idx
  on public.catalog_banners (tenant_id, store_id, active, position);

-- ============ RLS ============
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.catalog_settings enable row level security;
alter table public.catalog_banners enable row level security;

-- Leitura do próprio painel. Escrita segue server-only/service_role.
create policy categories_member_read on public.categories
  for select to authenticated using (private.is_store_member(store_id));

create policy product_variants_member_read on public.product_variants
  for select to authenticated using (private.is_store_member(store_id));

create policy product_images_member_read on public.product_images
  for select to authenticated using (private.is_store_member(store_id));

create policy catalog_settings_member_read on public.catalog_settings
  for select to authenticated using (private.is_store_member(store_id));

create policy catalog_banners_member_read on public.catalog_banners
  for select to authenticated using (private.is_store_member(store_id));

-- Catálogo público permanece sem policies para anon.
-- O servidor resolve hostname -> tenant/store e consulta com boundary administrativo.
