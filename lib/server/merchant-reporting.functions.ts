import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import type {
  MerchantOperationsReport,
  MerchantOpsSqlExecutor,
  MerchantScope,
} from "../../../../../packages/merchant-ops/src/index.ts";
import { createMerchantOperationsContext } from "./operations-context.server.ts";
import { loadMerchantOperationsReport } from "./operations-dashboard.functions.ts";

export interface MerchantProductPerformance {
  productId: string | null;
  productName: string;
  quantitySold: number;
  salesCents: number;
  orderCount: number;
}

export interface MerchantCustomerPerformance {
  customerId: string;
  customerName: string;
  orderCount: number;
  salesCents: number;
  lastPurchaseAt: string;
}

export interface MerchantFinanceCategoryPerformance {
  categoryId: string | null;
  categoryName: string;
  direction: "receivable" | "payable";
  entryCount: number;
  amountCents: number;
}

export interface MerchantOperationalReport extends MerchantOperationsReport {
  averageTicketCents: number;
  newCustomers: number;
  topProducts: MerchantProductPerformance[];
  topCustomers: MerchantCustomerPerformance[];
  financeByCategory: MerchantFinanceCategoryPerformance[];
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reportSchema = z.object({ from: dateSchema.optional(), to: dateSchema.optional() });

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Campo de relatório inválido: ${key}`);
  return value;
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`Campo de relatório inválido: ${key}`);
  return value;
}

function integer(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  if (!Number.isSafeInteger(value)) throw new Error(`Indicador de relatório inválido: ${key}`);
  return value;
}

function defaultRange(now = new Date()): { from: string; to: string } {
  const to = now.toISOString().slice(0, 10);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
  return { from: start.toISOString().slice(0, 10), to };
}

const NEW_CUSTOMERS_SQL = `select count(*)::integer as new_customers
  from public.customers c
  where c.tenant_id=$1 and c.store_id=$2
    and c.created_at::date between $3::date and $4::date`;

const PRODUCT_PERFORMANCE_SQL = `select
    oi.product_id::text as product_id,
    oi.product_name,
    coalesce(sum(oi.quantity),0)::integer as quantity_sold,
    coalesce(sum(oi.total_cents),0)::bigint as sales_cents,
    count(distinct o.id)::integer as order_count
  from public.order_items oi
  join public.orders o
    on o.tenant_id=oi.tenant_id and o.store_id=oi.store_id and o.id=oi.order_id
  where o.tenant_id=$1 and o.store_id=$2
    and o.status='completed'
    and o.payment_status not in ('failed','refunded','cancelled')
    and coalesce(o.completed_at,o.updated_at)::date between $3::date and $4::date
  group by oi.product_id,oi.product_name
  order by sales_cents desc,quantity_sold desc,oi.product_name asc
  limit 20`;

const CUSTOMER_PERFORMANCE_SQL = `select
    c.id::text as customer_id,
    c.name as customer_name,
    count(o.id)::integer as order_count,
    coalesce(sum(o.total_cents),0)::bigint as sales_cents,
    max(coalesce(o.completed_at,o.updated_at))::text as last_purchase_at
  from public.orders o
  join public.customers c
    on c.tenant_id=o.tenant_id and c.store_id=o.store_id and c.id=o.customer_id
  where o.tenant_id=$1 and o.store_id=$2
    and o.status='completed'
    and o.payment_status not in ('failed','refunded','cancelled')
    and coalesce(o.completed_at,o.updated_at)::date between $3::date and $4::date
  group by c.id,c.name
  order by sales_cents desc,order_count desc,c.name asc
  limit 20`;

const FINANCE_CATEGORY_SQL = `select
    e.category_id::text as category_id,
    coalesce(c.name,'Sem categoria') as category_name,
    e.direction,
    count(*)::integer as entry_count,
    coalesce(sum(e.amount_cents),0)::bigint as amount_cents
  from public.merchant_financial_entries e
  left join public.merchant_financial_categories c
    on c.tenant_id=e.tenant_id and c.store_id=e.store_id and c.id=e.category_id
  where e.tenant_id=$1 and e.store_id=$2
    and e.status<>'cancelled'
    and e.competence_date between $3::date and $4::date
  group by e.category_id,c.name,e.direction
  order by e.direction,amount_cents desc,category_name asc`;

export async function loadMerchantOperationalReport(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  from: string,
  to: string,
): Promise<MerchantOperationalReport> {
  const base = await loadMerchantOperationsReport(sql, scope, from, to);
  const params = [scope.tenantId, scope.storeId, from, to];
  const [newCustomerRows, productRows, customerRows, financeRows] = await Promise.all([
    sql.query(NEW_CUSTOMERS_SQL, params),
    sql.query(PRODUCT_PERFORMANCE_SQL, params),
    sql.query(CUSTOMER_PERFORMANCE_SQL, params),
    sql.query(FINANCE_CATEGORY_SQL, params),
  ]);
  return {
    ...base,
    averageTicketCents: base.completedOrders > 0 ? Math.round(base.salesCents / base.completedOrders) : 0,
    newCustomers: integer(newCustomerRows[0] ?? {}, "new_customers"),
    topProducts: productRows.map((row) => ({
      productId: nullableText(row, "product_id"),
      productName: text(row, "product_name"),
      quantitySold: integer(row, "quantity_sold"),
      salesCents: integer(row, "sales_cents"),
      orderCount: integer(row, "order_count"),
    })),
    topCustomers: customerRows.map((row) => ({
      customerId: text(row, "customer_id"),
      customerName: text(row, "customer_name"),
      orderCount: integer(row, "order_count"),
      salesCents: integer(row, "sales_cents"),
      lastPurchaseAt: text(row, "last_purchase_at"),
    })),
    financeByCategory: financeRows.map((row) => ({
      categoryId: nullableText(row, "category_id"),
      categoryName: text(row, "category_name"),
      direction: text(row, "direction") as "receivable" | "payable",
      entryCount: integer(row, "entry_count"),
      amountCents: integer(row, "amount_cents"),
    })),
  };
}

export const getMerchantOperationalReport = createServerFn({ method: "GET" })
  .validator(reportSchema)
  .handler(async ({ data }) => {
    const current = await createMerchantOperationsContext(getRequestHost());
    const defaults = defaultRange();
    return loadMerchantOperationalReport(
      current.sql,
      current.scope,
      data.from ?? defaults.from,
      data.to ?? defaults.to,
    );
  });
