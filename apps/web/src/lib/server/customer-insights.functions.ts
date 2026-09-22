import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import type { MerchantOpsSqlExecutor, MerchantScope } from "../../../../../packages/merchant-ops/src/index.ts";
import { createMerchantOperationsContext } from "./operations-context.server.ts";
import { assertCustomersEntitlement } from "./customers-entitlements.server.ts";

export interface CustomerPurchasedProduct {
  productId: string | null;
  productName: string;
  quantity: number;
  salesCents: number;
  orderCount: number;
  lastPurchasedAt: string;
}

export interface MerchantCustomerInsights {
  completedOrders: number;
  totalSpentCents: number;
  averageTicketCents: number;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  recencyDays: number | null;
  averageDaysBetweenPurchases: number | null;
  products: CustomerPurchasedProduct[];
}

const idSchema = z.object({ id: z.string().uuid() });

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Campo de cliente inválido: ${key}`);
  return value;
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`Campo de cliente inválido: ${key}`);
  return value;
}

function integer(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  if (!Number.isSafeInteger(value)) throw new Error(`Indicador de cliente inválido: ${key}`);
  return value;
}

function nullableInteger(row: Record<string, unknown>, key: string): number | null {
  if (row[key] === null || row[key] === undefined) return null;
  return integer(row, key);
}

const CUSTOMER_METRICS_SQL = `select
    c.id::text as customer_id,
    count(o.id) filter (
      where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
    )::integer as completed_orders,
    coalesce(sum(o.total_cents) filter (
      where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
    ),0)::bigint as total_spent_cents,
    round(coalesce(avg(o.total_cents) filter (
      where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
    ),0))::bigint as average_ticket_cents,
    min(coalesce(o.completed_at,o.updated_at)) filter (
      where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
    )::text as first_purchase_at,
    max(coalesce(o.completed_at,o.updated_at)) filter (
      where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
    )::text as last_purchase_at,
    case when count(o.id) filter (
      where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
    )=0 then null else (
      current_date - (max(coalesce(o.completed_at,o.updated_at)) filter (
        where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
      ))::date
    )::integer end as recency_days,
    case when count(o.id) filter (
      where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
    )<2 then null else round(
      extract(epoch from (
        (max(coalesce(o.completed_at,o.updated_at)) filter (
          where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
        )) -
        (min(coalesce(o.completed_at,o.updated_at)) filter (
          where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
        ))
      )) / 86400 /
      ((count(o.id) filter (
        where o.status='completed' and o.payment_status not in ('failed','refunded','cancelled')
      )) - 1)
    )::integer end as average_days_between_purchases
  from public.customers c
  left join public.orders o
    on o.tenant_id=c.tenant_id and o.store_id=c.store_id and o.customer_id=c.id
  where c.tenant_id=$1 and c.store_id=$2 and c.id=$3::uuid
  group by c.id`;

const CUSTOMER_PRODUCTS_SQL = `select
    oi.product_id::text as product_id,
    oi.product_name,
    coalesce(sum(oi.quantity),0)::integer as quantity,
    coalesce(sum(oi.total_cents),0)::bigint as sales_cents,
    count(distinct o.id)::integer as order_count,
    max(coalesce(o.completed_at,o.updated_at))::text as last_purchased_at
  from public.orders o
  join public.order_items oi
    on oi.tenant_id=o.tenant_id and oi.store_id=o.store_id and oi.order_id=o.id
  where o.tenant_id=$1 and o.store_id=$2 and o.customer_id=$3::uuid
    and o.status='completed'
    and o.payment_status not in ('failed','refunded','cancelled')
  group by oi.product_id,oi.product_name
  order by sales_cents desc,quantity desc,oi.product_name asc
  limit 50`;

export async function loadMerchantCustomerInsights(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  customerId: string,
): Promise<MerchantCustomerInsights> {
  const [metricRows, productRows] = await Promise.all([
    sql.query(CUSTOMER_METRICS_SQL, [scope.tenantId, scope.storeId, customerId]),
    sql.query(CUSTOMER_PRODUCTS_SQL, [scope.tenantId, scope.storeId, customerId]),
  ]);
  const row = metricRows[0];
  if (!row) throw new Error("Cliente não encontrado");
  return {
    completedOrders: integer(row, "completed_orders"),
    totalSpentCents: integer(row, "total_spent_cents"),
    averageTicketCents: integer(row, "average_ticket_cents"),
    firstPurchaseAt: nullableText(row, "first_purchase_at"),
    lastPurchaseAt: nullableText(row, "last_purchase_at"),
    recencyDays: nullableInteger(row, "recency_days"),
    averageDaysBetweenPurchases: nullableInteger(row, "average_days_between_purchases"),
    products: productRows.map((product) => ({
      productId: nullableText(product, "product_id"),
      productName: text(product, "product_name"),
      quantity: integer(product, "quantity"),
      salesCents: integer(product, "sales_cents"),
      orderCount: integer(product, "order_count"),
      lastPurchasedAt: text(product, "last_purchased_at"),
    })),
  };
}

export const getMerchantCustomerInsights = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await createMerchantOperationsContext(getRequestHost());
    await assertCustomersEntitlement(current.sql, current.scope);
    return loadMerchantCustomerInsights(current.sql, current.scope, data.id);
  });
