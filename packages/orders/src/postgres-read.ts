import { mapOrder, mapOrderItem } from "./mapper.ts";
import { assertOrderScope } from "./validation.ts";
import type { OrderSqlExecutor } from "./repository.ts";
import type {
  Order,
  OrderListQuery,
  OrderPage,
  OrderScope,
  OrderTimelineEntry,
} from "./types.ts";

export const ORDER_COLUMNS =
  "id,tenant_id,store_id,order_number,origin,status,payment_status," +
  "customer_id,customer_name,customer_phone,coupon_id,coupon_code_snapshot," +
  "notes,subtotal_cents,discount_cents,shipping_cents,total_cents,created_at," +
  "updated_at,confirmed_at,completed_at,cancelled_at";

const ITEM_COLUMNS =
  "id,tenant_id,store_id,order_id,product_id,variant_id,product_name," +
  "variant_name,sku_snapshot,qty,unit_cents,total_cents";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function pageNumber(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function pageSize(value: number): number {
  return Number.isInteger(value) && value > 0
    ? Math.min(value, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
}

function rowTimestamp(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error("Data de auditoria inválida");
}

function mapTimeline(row: Record<string, unknown>): OrderTimelineEntry {
  const metadata = row["metadata"];
  return {
    id: String(row["id"]),
    action: String(row["action"]),
    actorUserId: typeof row["actor_user_id"] === "string"
      ? row["actor_user_id"]
      : null,
    metadata: metadata && typeof metadata === "object"
      ? metadata as Record<string, unknown>
      : {},
    createdAt: rowTimestamp(row["created_at"]),
  };
}

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

export async function getOrderTimeline(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  id: string,
): Promise<OrderTimelineEntry[]> {
  assertOrderScope(scope);
  const rows = await sql.query(
    `select a.id::text,a.actor_user_id::text,a.action,a.metadata,a.created_at
     from public.audit_logs a
     where a.tenant_id=$1 and a.store_id=$2
       and a.resource_type='order' and a.resource_id=$3
       and exists (
         select 1 from public.orders o
         where o.tenant_id=$1 and o.store_id=$2 and o.id=$3::uuid
       )
     order by a.created_at,a.id`,
    [scope.tenantId, scope.storeId, id],
  );
  return rows.map(mapTimeline);
}

export async function listOrdersPage(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  query: OrderListQuery,
): Promise<OrderPage> {
  assertOrderScope(scope);
  const page = pageNumber(query.page);
  const size = pageSize(query.pageSize);
  const search = query.search?.trim() || null;
  const status = query.status ?? null;
  const date = query.date?.trim() || null;
  const rows = await sql.query(
    `select ${ORDER_COLUMNS},count(*) over()::integer as total_count
     from public.orders
     where tenant_id=$1 and store_id=$2
       and ($3::text is null
         or order_number::text ilike '%' || $3 || '%'
         or coalesce(customer_name,'') ilike '%' || $3 || '%'
         or coalesce(customer_phone,'') ilike '%' || $3 || '%')
       and ($4::text is null or status=$4)
       and ($5::date is null or created_at::date=$5::date)
     order by created_at desc,id desc
     limit $6 offset $7`,
    [
      scope.tenantId,
      scope.storeId,
      search,
      status,
      date,
      size,
      (page - 1) * size,
    ],
  );
  return {
    items: await hydrate(sql, rows),
    page,
    pageSize: size,
    total: rows.length ? Number(rows[0]?.["total_count"] ?? 0) : 0,
  };
}

export async function listOrders(
  sql: OrderSqlExecutor,
  scope: OrderScope,
  limit: number,
): Promise<Order[]> {
  const page = await listOrdersPage(sql, scope, {
    page: 1,
    pageSize: Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE),
  });
  return page.items;
}
