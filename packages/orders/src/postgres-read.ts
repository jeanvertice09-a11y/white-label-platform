import { mapOrder, mapOrderItem } from "./mapper.ts";
import { assertOrderScope } from "./validation.ts";
import type { OrderSqlExecutor } from "./repository.ts";
import type { Order, OrderScope } from "./types.ts";

export const ORDER_COLUMNS =
  "id,tenant_id,store_id,order_number,origin,status,payment_status," +
  "customer_name,customer_phone,notes,subtotal_cents,discount_cents," +
  "shipping_cents,total_cents,created_at,updated_at,confirmed_at,completed_at,cancelled_at";

const ITEM_COLUMNS =
  "id,tenant_id,store_id,order_id,product_id,variant_id,product_name," +
  "variant_name,sku_snapshot,qty,unit_cents,total_cents";

async function hydrate(
  sql: OrderSqlExecutor,
  rows: Record<string, unknown>[],
): Promise<Order[]> {
  if (rows.length === 0) return [];
  const first = rows[0];
  const tenantId = String(first["tenant_id"]);
  const storeId = String(first["store_id"]);
  const ids = rows.map((row) => String(row["id"]));
  const itemRows = await sql.query(
    `select ${ITEM_COLUMNS} from public.order_items
     where tenant_id=$1 and store_id=$2 and order_id=any($3::uuid[])
     order by order_id,id`,
    [tenantId, storeId, ids],
  );
  const items = itemRows.map(mapOrderItem);
  return rows.map((row) => {
    const id = String(row["id"]);
    return mapOrder(row, items.filter((item) => item.orderId === id));
  });
}

export async function getOrderById(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  id: string,
): Promise<Order | null> {
  assertOrderScope(scope);
  const rows = await sql.query(
    `select ${ORDER_COLUMNS} from public.orders
     where tenant_id=$1 and store_id=$2 and id=$3 limit 1`,
    [scope.tenantId, scope.storeId, id],
  );
  const orders = await hydrate(sql, rows);
  return orders[0] ?? null;
}

export async function listOrders(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  limit: number,
): Promise<Order[]> {
  assertOrderScope(scope);
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const rows = await sql.query(
    `select ${ORDER_COLUMNS} from public.orders
     where tenant_id=$1 and store_id=$2
     order by created_at desc limit $3`,
    [scope.tenantId, scope.storeId, safeLimit],
  );
  return hydrate(sql, rows);
}
