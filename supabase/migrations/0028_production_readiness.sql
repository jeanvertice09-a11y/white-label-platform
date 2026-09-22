-- 0027_production_readiness.sql — analytics interno mínimo e tenant/store scoped.
-- Os eventos não armazenam PII, IP, user-agent ou payload arbitrário.

create table public.storefront_analytics_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  event_id uuid not null,
  session_id uuid not null,
  event_type text not null,
  product_id uuid,
  order_id uuid,
  value_cents bigint,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id) on delete cascade,
  foreign key (tenant_id, store_id, product_id)
    references public.products (tenant_id, store_id, id) on delete set null (product_id),
  foreign key (tenant_id, store_id, order_id)
    references public.orders (tenant_id, store_id, id) on delete set null (order_id),
  unique (tenant_id, store_id, event_id),
  constraint storefront_analytics_event_type_ck check (
    event_type in ('catalog_view','product_view','add_to_cart','begin_checkout','order_created')
  ),
  constraint storefront_analytics_value_ck check (value_cents is null or value_cents >= 0)
);

create index storefront_analytics_store_period_idx
  on public.storefront_analytics_events (tenant_id, store_id, occurred_at desc);
create index storefront_analytics_store_event_idx
  on public.storefront_analytics_events (tenant_id, store_id, event_type, occurred_at desc);
create index storefront_analytics_store_session_idx
  on public.storefront_analytics_events (tenant_id, store_id, session_id, occurred_at desc);

-- Browser/anon nunca acessa a tabela diretamente. O boundary server-side resolve
-- tenant/store pelo hostname ativo e verificado antes de gravar/consultar.
alter table public.storefront_analytics_events enable row level security;
