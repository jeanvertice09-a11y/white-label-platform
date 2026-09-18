import { getOrderById } from "./postgres-read.ts";
import { assertOrderScope } from "./validation.ts";
import type { OrderSqlExecutor } from "./repository.ts";
import type { Order, OrderScope, OrderStatus } from "./types.ts";

const APPLY_STOCK_SQL = `
, variant_delta as (
  select tenant_id,store_id,product_id,variant_id,sum(delta)::integer as delta
  from movements where variant_id is not null
  group by tenant_id,store_id,product_id,variant_id
), update_variants as (
  update public.product_variants v
  set stock_quantity=v.stock_quantity+d.delta,updated_at=now()
  from variant_delta d
  where v.tenant_id=d.tenant_id and v.store_id=d.store_id
    and v.product_id=d.product_id and v.id=d.variant_id
  returning v.id
), product_delta as (
  select tenant_id,store_id,product_id,sum(delta)::integer as delta
  from movements where variant_id is null
  group by tenant_id,store_id,product_id
)
update public.products p
set stock_quantity=p.stock_quantity+d.delta,updated_at=now()
from product_delta d
where p.tenant_id=d.tenant_id and p.store_id=d.store_id and p.id=d.product_id
returning p.id`;

export async function confirmOrder(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  id: string,
): Promise<Order | null> {
  assertOrderScope(scope);
  await sql.query(
    `with changed as (
       update public.orders set
         status='confirmed',confirmed_at=coalesce(confirmed_at,now()),updated_at=now()
       where tenant_id=$1 and store_id=$2 and id=$3 and status='pending'
       returning id
     ), tracked as (
       select oi.*
       from public.order_items oi
       join changed c on c.id=oi.order_id
       join public.products p
         on p.tenant_id=oi.tenant_id and p.store_id=oi.store_id and p.id=oi.product_id
       where p.track_inventory=true
     ), movements as (
       insert into public.stock_movements (
         tenant_id,store_id,product_id,variant_id,delta,reason,
         movement_type,reference_type,reference_id
       )
       select tenant_id,store_id,product_id,variant_id,-qty,
         'Confirmação de pedido','sale','order',order_id
       from tracked
       on conflict do nothing
       returning tenant_id,store_id,product_id,variant_id,delta
     )${APPLY_STOCK_SQL}`,
    [scope.tenantId, scope.storeId, id],
  );
  return getOrderById(sql, scope, id);
}

export async function cancelOrder(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  id: string,
): Promise<Order | null> {
  assertOrderScope(scope);
  await sql.query(
    `with locked as (
       select id,status from public.orders
       where tenant_id=$1 and store_id=$2 and id=$3 for update
     ), changed as (
       update public.orders o
       set status='cancelled',cancelled_at=coalesce(cancelled_at,now()),updated_at=now()
       from locked l
       where o.id=l.id and l.status in ('pending','confirmed','preparing','ready')
       returning o.id,l.status as previous_status
     ), tracked as (
       select oi.*
       from public.order_items oi
       join changed c on c.id=oi.order_id
       join public.products p
         on p.tenant_id=oi.tenant_id and p.store_id=oi.store_id and p.id=oi.product_id
       where p.track_inventory=true and c.previous_status <> 'pending'
     ), movements as (
       insert into public.stock_movements (
         tenant_id,store_id,product_id,variant_id,delta,reason,
         movement_type,reference_type,reference_id
       )
       select tenant_id,store_id,product_id,variant_id,qty,
         'Cancelamento de pedido','cancellation','order',order_id
       from tracked
       on conflict do nothing
       returning tenant_id,store_id,product_id,variant_id,delta
     )${APPLY_STOCK_SQL}`,
    [scope.tenantId, scope.storeId, id],
  );
  return getOrderById(sql, scope, id);
}

export async function advanceOrder(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  id: string,
  status: Extract<OrderStatus, "preparing" | "ready" | "completed">,
): Promise<Order | null> {
  assertOrderScope(scope);
  await sql.query(
    `update public.orders set
       status=$4,
       completed_at=case when $4='completed' then coalesce(completed_at,now()) else completed_at end,
       updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3
       and (
         ($4='preparing' and status='confirmed')
         or ($4='ready' and status='preparing')
         or ($4='completed' and status='ready')
       )`,
    [scope.tenantId, scope.storeId, id, status],
  );
  return getOrderById(sql, scope, id);
}
