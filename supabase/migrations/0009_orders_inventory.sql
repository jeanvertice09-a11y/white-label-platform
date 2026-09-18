-- 0009_orders_inventory.sql — pedidos reais + estoque tenant/store scoped.

-- ---------- PEDIDOS ----------
create sequence if not exists public.order_number_seq;

alter table public.orders
  add column if not exists order_number bigint,
  add column if not exists origin text not null default 'manual',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists notes text,
  add column if not exists subtotal_cents bigint,
  add column if not exists discount_cents bigint not null default 0,
  add column if not exists shipping_cents bigint not null default 0,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists confirmed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists idempotency_key text;

alter table public.orders
  alter column order_number set default nextval('public.order_number_seq');

update public.orders
set order_number = nextval('public.order_number_seq')
where order_number is null;

update public.orders
set subtotal_cents = total_cents
where subtotal_cents is null;

alter table public.orders
  alter column order_number set not null,
  alter column subtotal_cents set not null,
  add constraint orders_status_ck check (
    status in ('pending','confirmed','preparing','ready','completed','cancelled')
  ),
  add constraint orders_origin_ck check (
    origin in ('whatsapp','online','manual','pdv')
  ),
  add constraint orders_payment_status_ck check (
    payment_status in ('pending','paid','failed','refunded','cancelled')
  ),
  add constraint orders_totals_ck check (
    subtotal_cents >= 0
    and discount_cents >= 0
    and shipping_cents >= 0
    and total_cents >= 0
    and total_cents = subtotal_cents - discount_cents + shipping_cents
  );

-- Compatibilidade com código legado que ainda informa apenas total_cents.
create or replace function private.orders_fill_legacy_subtotal()
returns trigger
language plpgsql
set search_path = pg_catalog
as $
begin
  if NEW.subtotal_cents is null then
    NEW.subtotal_cents := NEW.total_cents + NEW.discount_cents - NEW.shipping_cents;
  end if;
  return NEW;
end;
$;

drop trigger if exists orders_fill_legacy_subtotal_trg on public.orders;
create trigger orders_fill_legacy_subtotal_trg
  before insert or update of subtotal_cents,discount_cents,shipping_cents,total_cents
  on public.orders
  for each row execute function private.orders_fill_legacy_subtotal();

create unique index orders_number_uidx on public.orders (order_number);
create unique index orders_store_idempotency_uidx
  on public.orders (tenant_id, store_id, idempotency_key)
  where idempotency_key is not null;
create index orders_store_status_created_idx
  on public.orders (tenant_id, store_id, status, created_at desc);

-- ---------- SNAPSHOTS DOS ITENS ----------
alter table public.order_items
  add column if not exists variant_id uuid,
  add column if not exists product_name text,
  add column if not exists variant_name text,
  add column if not exists sku_snapshot text,
  add column if not exists total_cents bigint;

update public.order_items oi
set product_name = coalesce(p.name, 'Produto removido'),
    sku_snapshot = p.sku,
    total_cents = oi.qty * oi.unit_cents
from public.products p
where p.id = oi.product_id
  and p.tenant_id = oi.tenant_id
  and p.store_id = oi.store_id;

update public.order_items
set product_name = 'Produto removido'
where product_name is null;

update public.order_items
set total_cents = qty * unit_cents
where total_cents is null;

alter table public.order_items
  alter column product_name set not null,
  alter column total_cents set not null,
  add constraint order_items_total_ck check (total_cents = qty * unit_cents),
  add constraint order_items_variant_requires_product_ck check (
    variant_id is null or product_id is not null
  ),
  add constraint order_items_variant_fk
    foreign key (tenant_id, store_id, product_id, variant_id)
    references public.product_variants (tenant_id, store_id, product_id, id)
    on delete set null (variant_id);

create index order_items_order_scope_idx
  on public.order_items (tenant_id, store_id, order_id);

-- ---------- ESTOQUE ----------
alter table public.stock_movements
  add column if not exists variant_id uuid,
  add column if not exists movement_type text not null default 'manual',
  add column if not exists reference_type text,
  add column if not exists reference_id uuid,
  add column if not exists created_by uuid;

alter table public.stock_movements
  add constraint stock_movements_type_ck check (
    movement_type in ('initial','purchase','sale','adjustment','return','cancellation','manual')
  ),
  add constraint stock_movements_variant_requires_product_ck check (
    variant_id is null or product_id is not null
  ),
  add constraint stock_movements_variant_fk
    foreign key (tenant_id, store_id, product_id, variant_id)
    references public.product_variants (tenant_id, store_id, product_id, id)
    on delete set null (variant_id);

create index stock_movements_scope_product_idx
  on public.stock_movements (tenant_id, store_id, product_id, variant_id, created_at desc);

create unique index stock_movements_reference_uidx
  on public.stock_movements (
    tenant_id,
    store_id,
    movement_type,
    reference_type,
    reference_id,
    product_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where reference_type is not null and reference_id is not null;

-- O ledger vira a fonte canônica. Backfill do saldo materializado atual.
insert into public.stock_movements (
  tenant_id, store_id, product_id, variant_id, delta, reason, movement_type
)
select
  v.tenant_id,
  v.store_id,
  v.product_id,
  v.id,
  v.stock_quantity,
  'Saldo inicial migrado',
  'initial'
from public.product_variants v
join public.products p
  on p.tenant_id=v.tenant_id and p.store_id=v.store_id and p.id=v.product_id
where p.track_inventory=true
  and v.stock_quantity <> 0
  and not exists (
    select 1 from public.stock_movements sm
    where sm.tenant_id=v.tenant_id
      and sm.store_id=v.store_id
      and sm.product_id=v.product_id
      and sm.variant_id=v.id
  );

insert into public.stock_movements (
  tenant_id, store_id, product_id, variant_id, delta, reason, movement_type
)
select
  p.tenant_id,
  p.store_id,
  p.id,
  null,
  p.stock_quantity,
  'Saldo inicial migrado',
  'initial'
from public.products p
where p.track_inventory=true
  and p.stock_quantity <> 0
  and not exists (
    select 1 from public.product_variants v
    where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id
  )
  and not exists (
    select 1 from public.stock_movements sm
    where sm.tenant_id=p.tenant_id
      and sm.store_id=p.store_id
      and sm.product_id=p.id
      and sm.variant_id is null
  );

-- RLS já estava habilitado em orders/order_items/stock_movements.
-- Escritas continuam somente pelo boundary server-side/service role.
