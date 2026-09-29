import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import type { SqlExecutor } from "@white-label/domains";
import { createPublicCatalogContext } from "./catalog-context.server.ts";
import { controlMerchantRead } from "./control-merchants.shared.server.ts";
import { createMerchantOperationsContext } from "./operations-context.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";

const EVENT_TYPES = [
  "catalog_view",
  "product_view",
  "add_to_cart",
  "begin_checkout",
  "order_created",
] as const;

const eventSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  type: z.enum(EVENT_TYPES),
  productId: z.string().uuid().nullable().optional(),
  orderId: z.string().uuid().nullable().optional(),
  valueCents: z.number().int().min(0).max(1_000_000_000_000).nullable().optional(),
});
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const rangeSchema = z.object({ from: dateSchema.optional(), to: dateSchema.optional() });
type AnalyticsInput = z.infer<typeof eventSchema>;
type AnalyticsScope = { tenantId: string; storeId?: string };

export interface StorefrontAnalyticsSummary {
  from: string;
  to: string;
  visits: number;
  productViews: number;
  addToCart: number;
  checkoutStarts: number;
  orders: number;
  conversionRate: number;
}

function defaultRange(now = new Date()): { from: string; to: string } {
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
  return { from: fromDate.toISOString().slice(0, 10), to };
}

function resolveRange(input: z.infer<typeof rangeSchema>): { from: string; to: string } {
  const defaults = defaultRange();
  const range = { from: input.from ?? defaults.from, to: input.to ?? defaults.to };
  if (range.from > range.to) throw new Error("Período de analytics inválido");
  return range;
}

function integer(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Métrica inválida: ${key}`);
  return value;
}

async function authoritativeEventValues(
  input: AnalyticsInput,
  tenantId: string,
  storeId: string,
): Promise<{ productId: string | null; orderId: string | null; valueCents: number | null }> {
  const sql = createAdminSqlExecutor();
  if (input.type === "product_view" || input.type === "add_to_cart") {
    if (!input.productId) throw new Error("Produto ausente no evento");
    const rows = await sql.query(
      `select id::text from public.products
       where tenant_id=$1::uuid and store_id=$2::uuid and id=$3::uuid limit 1`,
      [tenantId, storeId, input.productId],
    );
    if (rows.length === 0) throw new Error("Produto fora do catálogo atual");
    return {
      productId: input.productId,
      orderId: null,
      valueCents: input.type === "add_to_cart" ? (input.valueCents ?? null) : null,
    };
  }
  if (input.type === "order_created") {
    if (!input.orderId) throw new Error("Pedido ausente no evento");
    const rows = await sql.query(
      `select id::text,total_cents from public.orders
       where tenant_id=$1::uuid and store_id=$2::uuid and id=$3::uuid limit 1`,
      [tenantId, storeId, input.orderId],
    );
    if (rows.length === 0) throw new Error("Pedido fora da loja atual");
    const row = rows[0];
    const value = Number(row["total_cents"] ?? 0);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Total do pedido inválido");
    return { productId: null, orderId: input.orderId, valueCents: value };
  }
  return {
    productId: null,
    orderId: null,
    valueCents: input.type === "begin_checkout" ? (input.valueCents ?? null) : null,
  };
}

async function persistStorefrontAnalyticsEvent(input: AnalyticsInput): Promise<void> {
  const context = await createPublicCatalogContext(getRequestHost());
  const values = await authoritativeEventValues(input, context.scope.tenantId, context.scope.storeId);
  await createAdminSqlExecutor().query(
    `insert into public.storefront_analytics_events(
       tenant_id,store_id,event_id,session_id,event_type,product_id,order_id,value_cents
     ) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::uuid,$7::uuid,$8::bigint)
     on conflict (tenant_id,store_id,event_id) do nothing`,
    [
      context.scope.tenantId,
      context.scope.storeId,
      input.eventId,
      input.sessionId,
      input.type,
      values.productId,
      values.orderId,
      values.valueCents,
    ],
  );
}

export const recordStorefrontAnalytics = createServerFn({ method: "POST" })
  .validator(eventSchema)
  .handler(async ({ data }) => {
    await persistStorefrontAnalyticsEvent(data);
    return { recorded: true } as const;
  });

const EVENT_METRICS_STORE_SQL = `select
  count(distinct session_id) filter (where event_type='catalog_view')::integer as visits,
  count(*) filter (where event_type='product_view')::integer as product_views,
  count(*) filter (where event_type='add_to_cart')::integer as add_to_cart,
  count(distinct session_id) filter (where event_type='begin_checkout')::integer as checkout_starts
from public.storefront_analytics_events
where tenant_id=$1::uuid and store_id=$2::uuid
  and occurred_at >= $3::date and occurred_at < ($4::date + interval '1 day')`;

const EVENT_METRICS_TENANT_SQL = `select
  count(distinct (store_id,session_id)) filter (where event_type='catalog_view')::integer as visits,
  count(*) filter (where event_type='product_view')::integer as product_views,
  count(*) filter (where event_type='add_to_cart')::integer as add_to_cart,
  count(distinct (store_id,session_id)) filter (where event_type='begin_checkout')::integer as checkout_starts
from public.storefront_analytics_events
where tenant_id=$1::uuid
  and occurred_at >= $2::date and occurred_at < ($3::date + interval '1 day')`;

async function loadSummary(
  sql: SqlExecutor,
  scope: AnalyticsScope,
  from: string,
  to: string,
): Promise<StorefrontAnalyticsSummary> {
  const eventParams = scope.storeId
    ? [scope.tenantId, scope.storeId, from, to]
    : [scope.tenantId, from, to];
  const eventSql = scope.storeId ? EVENT_METRICS_STORE_SQL : EVENT_METRICS_TENANT_SQL;
  const orderSql = scope.storeId
    ? `select count(*)::integer as orders from public.orders
       where tenant_id=$1::uuid and store_id=$2::uuid and origin in ('whatsapp','online')
         and status<>'cancelled' and created_at >= $3::date and created_at < ($4::date + interval '1 day')`
    : `select count(*)::integer as orders from public.orders
       where tenant_id=$1::uuid and origin in ('whatsapp','online') and status<>'cancelled'
         and created_at >= $2::date and created_at < ($3::date + interval '1 day')`;
  const [eventRows, orderRows] = await Promise.all([
    sql.query(eventSql, eventParams),
    sql.query(orderSql, eventParams),
  ]);
  const events = eventRows[0] ?? {};
  const orders = integer(orderRows[0] ?? {}, "orders");
  const visits = integer(events, "visits");
  return {
    from,
    to,
    visits,
    productViews: integer(events, "product_views"),
    addToCart: integer(events, "add_to_cart"),
    checkoutStarts: integer(events, "checkout_starts"),
    orders,
    conversionRate: visits > 0 ? Math.round((orders / visits) * 10_000) / 100 : 0,
  };
}

export const getCurrentStorefrontAnalytics = createServerFn({ method: "GET" })
  .validator((data: z.infer<typeof rangeSchema> | undefined) => rangeSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const current = await createMerchantOperationsContext(getRequestHost());
    const range = resolveRange(data);
    return loadSummary(current.sql, current.scope, range.from, range.to);
  });

export const getCurrentTenantStorefrontAnalytics = createServerFn({ method: "GET" })
  .validator((data: z.infer<typeof rangeSchema> | undefined) => rangeSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const current = await controlMerchantRead();
    const range = resolveRange(data);
    return loadSummary(current.sql, { tenantId: current.tenantId }, range.from, range.to);
  });
