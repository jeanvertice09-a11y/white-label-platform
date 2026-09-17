-- 0007_storefront_catalog.sql — catálogo/merchant admin tenant+store scoped.
-- Preserva migrations anteriores; toda relação de loja usa escopo composto.

-- ---------- CATEGORIAS ----------
alter table public.categories
  add column if not exists description text,
  add column if not exists parent_id uuid,
  add column if not exists active boolean not null default true,
  add column if not exists position integer not null default 0 check (position >= 0),
  add column if not exists updated_at timestamptz not null default now();

alter table public.categories
  add constraint categories_parent_fk
    foreign key (tenant_id, store_id, parent_id)
    references public.categories (tenant_id, store_id, id)
    on delete set null (parent_id);

create index categories_store_active_idx
  on public.categories (tenant_id, store_id, active, position, name);

-- ---------- PRODUTOS ----------
alter table public.products
  add column if not exists description text,
  add column if not exists sku text,
  add column if not exists compare_at_price_cents bigint check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  add column if not exists cost_cents bigint check (cost_cents is null or cost_cents >= 0),
  add column if not exists track_inventory boolean not null default false,
  add column if not exists stock_quantity integer not null default 0 check (stock_quantity >= 0),
  add column if not exists position integer not null default 0 check (position >= 0),
  add column if not exists updated_at timestamptz not null default now();

drop index if exists products_store_sku_uidx;
create unique index products_store_sku_uidx
  on public.products (tenant_id, store_id, sku)
  where sku is not null;

-- Corrige a ação de delete da FK composta antiga: somente category_id pode virar NULL.
alter table public.products
  drop constraint if exists products_category_fk,
  add constraint products_category_fk
    foreign key (tenant_id, store_id, category_id)
    references public.categories (tenant_id, store_id, id)
    on delete set null (category_id);

-- ---------- VARIANTES ----------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  product_id uuid not null,
  name text not null,
  sku text,
  attributes jsonb not null default '{}'::jsonb,
  price_cents bigint not null check (price_cents >= 0),
  compare_at_price_cents bigint check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  cost_cents bigint check (cost_cents is null or cost_cents >= 0),
  active boolean not null default true,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id, product_id)
    references public.products (tenant_id, store_id, id)
    on delete cascade,
  unique (tenant_id, store_id, id),
  unique (tenant_id, store_id, product_id, id)
);

create unique index product_variants_store_sku_uidx
  on public.product_variants (tenant_id, store_id, sku)
  where sku is not null;
create index product_variants_product_idx
  on public.product_variants (tenant_id, store_id, product_id, active, position);

-- ---------- IMAGENS ----------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  product_id uuid not null,
  variant_id uuid,
  object_key text not null,
  alt_text text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id, product_id)
    references public.products (tenant_id, store_id, id)
    on delete cascade,
  foreign key (tenant_id, store_id, product_id, variant_id)
    references public.product_variants (tenant_id, store_id, product_id, id)
    on delete set null (variant_id),
  constraint product_images_store_key_ck check (
    object_key like (
      'tenants/' || lower(tenant_id::text) || '/stores/' || lower(store_id::text) || '/%'
    )
  )
);
create index product_images_product_idx
  on public.product_images (tenant_id, store_id, product_id, position);

-- ---------- CONFIGURAÇÃO E BANNERS ----------
create table public.catalog_settings (
  tenant_id uuid not null,
  store_id uuid not null,
  layout text not null default 'classic' check (layout in ('classic', 'modern')),
  primary_color text not null default '#111827',
  accent_color text not null default '#2563eb',
  background_color text not null default '#ffffff',
  font_family text not null default 'system',
  show_search boolean not null default true,
  show_categories boolean not null default true,
  show_price boolean not null default true,
  show_stock boolean not null default false,
  labels jsonb not null default '{}'::jsonb,
  whatsapp_phone text,
  whatsapp_message text not null default 'Olá! Quero finalizar meu pedido:',
  checkout_mode text not null default 'whatsapp' check (checkout_mode in ('whatsapp', 'online', 'both')),
  seo_title text,
  seo_description text,
  updated_at timestamptz not null default now(),
  primary key (store_id),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id)
    on delete cascade
);

create table public.store_banners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  title text,
  alt_text text,
  image_object_key text not null,
  href text,
  active boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id)
    on delete cascade,
  constraint store_banners_store_key_ck check (
    image_object_key like (
      'tenants/' || lower(tenant_id::text) || '/stores/' || lower(store_id::text) || '/%'
    )
  )
);
create index store_banners_active_idx
  on public.store_banners (tenant_id, store_id, active, position);

-- ---------- RLS: deny-by-default ----------
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.catalog_settings enable row level security;
alter table public.store_banners enable row level security;

-- Nenhuma policy anon. Admin e catálogo passam por boundary server-side
-- tenant/store-scoped usando service_role após autorização/hostname confiável.
