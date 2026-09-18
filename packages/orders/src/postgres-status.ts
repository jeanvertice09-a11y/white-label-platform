import { orderStockSqlFragments } from "../../inventory/src/order-stock.ts";
import { getOrderById } from "./postgres-read.ts";
import { assertOrderScope } from "./validation.ts";
import type { OrderSqlExecutor } from "./repository.ts";
import type { Order, OrderScope, OrderStatus } from "./types.ts";

const stockSql = orderStockSqlFragments();

function previousStatus(row: Record<string, unknown>): OrderStatus {
  return String(row["previous_status"]) as OrderStatus;
}

function changed(row: Record<string, unknown>): boolean {
  return row["changed"] === true;
}

async function loadedOrder(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  id: string,
): Promise<Order> {
  const order = await getOrderById(sql, scope, id);
  if (!order) throw new Error("Pedido não encontrado após alteração");
  return order;
}

export async function confirmOrder(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  id: string,
  actorUserId: string | null = null,
): Promise<Order | null> {
  assertOrderScope(scope);
  const rows = await sql.query(
    `with candidate_order as (
       select id,status from public.orders
       where tenant_id=$1 and store_id=$2 and id=$3::uuid
       for update
     ), candidate_pending as (
       select id from candidate_order where status='pending'
     )
     ${stockSql.prepareConsume}
     , changed as (
       update public.orders o
       set status='confirmed',confirmed_at=coalesce(confirmed_at,now()),updated_at=now()
       from candidate_pending cp,stock_availability sa
       where o.tenant_id=$1 and o.store_id=$2 and o.id=cp.id and sa.allowed
       returning o.id
     )
     ${stockSql.applyConsume}
     , audit_status as (
       insert into public.audit_logs (
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select $4::uuid,$1::uuid,$2::uuid,'order.status_changed','order',id::text,
         jsonb_build_object('from','pending','to','confirmed')
       from changed
       returning id
     ), audit_stock as (
       insert into public.audit_logs (
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select $4::uuid,$1::uuid,$2::uuid,'order.stock_consumed','order',c.id::text,
         jsonb_build_object(
           'movement_count',(select count(*) from stock_movements_applied)
         )
       from changed c
       where exists(select 1 from stock_movements_applied)
       returning id
     )
     select c.status as previous_status,
       coalesce((select allowed from stock_availability),true) as stock_allowed,
       exists(select 1 from changed) as changed
     from candidate_order c`,
    [scope.tenantId, scope.storeId, id, actorUserId],
  );
  if (rows.length === 0) return null;
  const row = rows[0]!;
  const previous = previousStatus(row);
  if (previous === "confirmed") return loadedOrder(sql, scope, id);
  if (previous !== "pending") throw new Error("Transição de status inválida");
  if (row["stock_allowed"] !== true) throw new Error("Estoque insuficiente");
  if (!changed(row)) throw new Error("Não foi possível confirmar o pedido");
  return loadedOrder(sql, scope, id);
}

export async function cancelOrder(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  id: string,
  actorUserId: string | null = null,
): Promise<Order | null> {
  assertOrderScope(scope);
  const rows = await sql.query(
    `with candidate_order as (
       select id,status from public.orders
       where tenant_id=$1 and store_id=$2 and id=$3::uuid
       for update
     ), candidate_cancel as (
       select id,status as previous_status
       from candidate_order
       where status in ('pending','confirmed','preparing','ready')
     )
     ${stockSql.prepareRestore}
     , changed as (
       update public.orders o
       set status='cancelled',
         cancelled_at=coalesce(cancelled_at,now()),
         updated_at=now()
       from candidate_cancel cc
       where o.tenant_id=$1 and o.store_id=$2 and o.id=cc.id
       returning o.id,cc.previous_status
     )
     ${stockSql.applyRestore}
     , audit_cancel as (
       insert into public.audit_logs (
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select $4::uuid,$1::uuid,$2::uuid,'order.cancelled','order',id::text,
         jsonb_build_object('from',previous_status,'to','cancelled')
       from changed
       returning id
     ), audit_stock as (
       insert into public.audit_logs (
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select $4::uuid,$1::uuid,$2::uuid,'order.stock_restored','order',c.id::text,
         jsonb_build_object(
           'movement_count',(select count(*) from stock_restore_movements)
         )
       from changed c
       where exists(select 1 from stock_restore_movements)
       returning id
     )
     select c.status as previous_status,
       exists(select 1 from changed) as changed
     from candidate_order c`,
    [scope.tenantId, scope.storeId, id, actorUserId],
  );
  if (rows.length === 0) return null;
  const row = rows[0]!;
  const previous = previousStatus(row);
  if (previous === "cancelled") return loadedOrder(sql, scope, id);
  if (!["pending", "confirmed", "preparing", "ready"].includes(previous)) {
    throw new Error("Transição de status inválida");
  }
  if (!changed(row)) throw new Error("Não foi possível cancelar o pedido");
  return loadedOrder(sql, scope, id);
}

function expectedPrevious(
  status: Extract<OrderStatus, "preparing" | "ready" | "completed">,
): OrderStatus {
  if (status === "preparing") return "confirmed";
  if (status === "ready") return "preparing";
  return "ready";
}

export async function advanceOrder(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  id: string,
  status: Extract<OrderStatus, "preparing" | "ready" | "completed">,
  actorUserId: string | null = null,
): Promise<Order | null> {
  assertOrderScope(scope);
  const expected = expectedPrevious(status);
  const rows = await sql.query(
    `with candidate_order as (
       select id,status from public.orders
       where tenant_id=$1 and store_id=$2 and id=$3::uuid
       for update
     ), changed as (
       update public.orders o
       set status=$4,
         completed_at=case
           when $4='completed' then coalesce(completed_at,now())
           else completed_at
         end,
         updated_at=now()
       from candidate_order c
       where o.tenant_id=$1 and o.store_id=$2 and o.id=c.id and c.status=$5
       returning o.id
     ), audit_status as (
       insert into public.audit_logs (
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select $6::uuid,$1::uuid,$2::uuid,'order.status_changed','order',id::text,
         jsonb_build_object('from',$5::text,'to',$4::text)
       from changed
       returning id
     )
     select c.status as previous_status,
       exists(select 1 from changed) as changed
     from candidate_order c`,
    [scope.tenantId, scope.storeId, id, status, expected, actorUserId],
  );
  if (rows.length === 0) return null;
  const row = rows[0]!;
  const previous = previousStatus(row);
  if (previous === status) return loadedOrder(sql, scope, id);
  if (previous !== expected) throw new Error("Transição de status inválida");
  if (!changed(row)) throw new Error("Não foi possível atualizar o pedido");
  return loadedOrder(sql, scope, id);
}
