-- 0032_product_commercial_rules.sql — regras comerciais por produto e múltiplas categorias.
alter table public.products
  add column if not exists discount_type text check (discount_type is null or discount_type in ('percentage','fixed')),
  add column if not exists discount_value integer check (discount_value is null or discount_value >= 0),
  add column if not exists pix_discount_percent integer check (pix_discount_percent is null or pix_discount_percent between 0 and 100),
  add column if not exists free_shipping boolean not null default false;

create table if not exists public.product_categories (
  tenant_id uuid not null,
  store_id uuid not null,
  product_id uuid not null,
  category_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id,store_id,product_id,category_id),
  foreign key (tenant_id,store_id,product_id) references public.products(tenant_id,store_id,id) on delete cascade,
  foreign key (tenant_id,store_id,category_id) references public.categories(tenant_id,store_id,id) on delete cascade
);
create index if not exists product_categories_category_idx on public.product_categories(tenant_id,store_id,category_id,product_id);
alter table public.product_categories enable row level security;

-- Migra a categoria principal legada sem perder compatibilidade.
insert into public.product_categories(tenant_id,store_id,product_id,category_id)
select tenant_id,store_id,id,category_id from public.products where category_id is not null
on conflict do nothing;
