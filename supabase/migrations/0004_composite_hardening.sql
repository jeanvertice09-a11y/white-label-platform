-- 0004_composite_hardening.sql — integridade composta em TODA relação.
-- Regra: recurso de tenant/store nunca referencia recurso de outro tenant/store.
-- Imutabilidade: 0001-0003 preservados; correções entram aqui como ALTERs.

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
