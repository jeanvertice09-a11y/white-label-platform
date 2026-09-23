import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createCatalogReadRepository } from "@white-label/catalog";
import { PostgresMerchantOperationsRepository } from "../../../../../packages/merchant-ops/src/index.ts";
import type { MerchantOperationsReport, MerchantOpsSqlExecutor, MerchantScope } from "../../../../../packages/merchant-ops/src/index.ts";
import { getMerchantDashboardMetrics } from "@white-label/orders";
import { z } from "zod";
import { createMerchantOperationsContext } from "./operations-context.server.ts";

interface PlanSummary {
  name: string | null;
  slug: string | null;
  status: string;
}

export interface DashboardRecentOrder {
  id: string;
  orderNumber: number;
  customerName: string | null;
  status: string;
  totalCents: number;
  createdAt: string;
}

export interface DashboardTaskAlert {
  id: string;
  title: string;
  priority: string;
  dueAt: string | null;
}

export interface DashboardStockAlert {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  quantity: number;
}

export interface DashboardRecoveryAlert { id:string; kind:string; status:string; title:string; detail:string; orderId:string|null; createdAt:string; }

export interface MerchantDashboardActivity {
  recentOrders: DashboardRecentOrder[];
  taskAlerts: DashboardTaskAlert[];
  stockAlerts: DashboardStockAlert[];
  recoveryAlerts: DashboardRecoveryAlert[];
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reportRange = z.object({ from: date.optional(), to: date.optional() });

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function requiredText(value: unknown, key: string): string {
  if (typeof value !== "string") throw new Error(`Campo ${key} inválido`);
  return value;
}

function integer(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key]);
  if (!Number.isSafeInteger(value)) throw new Error(`Indicador ${key} inválido`);
  return value;
}

function defaultRange(now = new Date()): { from: string; to: string } {
  const to = now.toISOString().slice(0, 10);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
  return { from: start.toISOString().slice(0, 10), to };
}

function assertRange(from: string, to: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw new Error("Período inválido");
  }
}

const OPERATIONS_REPORT_SQL = `select
  (select count(*) from public.orders o
   where o.tenant_id=$1 and o.store_id=$2 and o.status='completed'
     and o.payment_status not in ('failed','refunded','cancelled')
     and coalesce(o.completed_at,o.updated_at)::date between $3::date and $4::date)::integer as completed_orders,
  (select coalesce(sum(o.total_cents),0) from public.orders o
   where o.tenant_id=$1 and o.store_id=$2 and o.status='completed'
     and o.payment_status not in ('failed','refunded','cancelled')
     and coalesce(o.completed_at,o.updated_at)::date between $3::date and $4::date)::bigint as sales_cents,
  (select count(distinct o.customer_id) from public.orders o
   where o.tenant_id=$1 and o.store_id=$2 and o.customer_id is not null and o.status='completed'
     and o.payment_status not in ('failed','refunded','cancelled')
     and coalesce(o.completed_at,o.updated_at)::date between $3::date and $4::date)::integer as buyers,
  (select count(*) from public.customers c where c.tenant_id=$1 and c.store_id=$2)::integer as customers,
  (select count(*) from public.products p where p.tenant_id=$1 and p.store_id=$2 and p.active=true)::integer as active_products,
  (select count(distinct p.id) from public.products p
   where p.tenant_id=$1 and p.store_id=$2 and p.active=true and p.track_inventory=true and (
     exists (
       select 1 from public.product_variants v
       where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id
         and coalesce((select sum(sm.delta) from public.stock_movements sm
           where sm.tenant_id=v.tenant_id and sm.store_id=v.store_id
             and sm.product_id=v.product_id and sm.variant_id=v.id),0)<=5
     ) or (
       not exists (select 1 from public.product_variants v
         where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id)
       and coalesce((select sum(sm.delta) from public.stock_movements sm
         where sm.tenant_id=p.tenant_id and sm.store_id=p.store_id
           and sm.product_id=p.id and sm.variant_id is null),0)<=5
     )
   ))::integer as low_stock_products,
  (select count(*) from public.merchant_purchases p
   where p.tenant_id=$1 and p.store_id=$2 and p.status='received'
     and p.received_at::date between $3::date and $4::date)::integer as received_purchases,
  (select coalesce(sum(p.total_cents),0) from public.merchant_purchases p
   where p.tenant_id=$1 and p.store_id=$2 and p.status='received'
     and p.received_at::date between $3::date and $4::date)::bigint as received_purchases_total_cents,
  (select count(*) from public.merchant_suppliers s where s.tenant_id=$1 and s.store_id=$2)::integer as suppliers,
  (select count(*) from public.merchant_suppliers s
   where s.tenant_id=$1 and s.store_id=$2 and s.status='active')::integer as active_suppliers,
  (select count(*) from public.merchant_tasks t
   where t.tenant_id=$1 and t.store_id=$2 and t.status='open')::integer as open_tasks,
  (select count(*) from public.merchant_tasks t
   where t.tenant_id=$1 and t.store_id=$2 and t.status='done'
     and t.completed_at::date between $3::date and $4::date)::integer as completed_tasks`;

export async function loadMerchantOperationsReport(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
  from: string,
  to: string,
): Promise<MerchantOperationsReport> {
  assertRange(from, to);
  const [rows, finance] = await Promise.all([
    sql.query(OPERATIONS_REPORT_SQL, [scope.tenantId, scope.storeId, from, to]),
    new PostgresMerchantOperationsRepository(sql).summarizeFinance(scope, from, to),
  ]);
  const row = rows[0];
  return {
    from,
    to,
    completedOrders: integer(row, "completed_orders"),
    salesCents: integer(row, "sales_cents"),
    buyers: integer(row, "buyers"),
    customers: integer(row, "customers"),
    activeProducts: integer(row, "active_products"),
    lowStockProducts: integer(row, "low_stock_products"),
    receivedPurchases: integer(row, "received_purchases"),
    receivedPurchasesTotalCents: integer(row, "received_purchases_total_cents"),
    suppliers: integer(row, "suppliers"),
    activeSuppliers: integer(row, "active_suppliers"),
    openTasks: integer(row, "open_tasks"),
    completedTasks: integer(row, "completed_tasks"),
    finance,
  };
}

export async function getCurrentStorePlan(
  sql: { query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> },
  tenantId: string,
  storeId: string,
): Promise<PlanSummary | null> {
  const rows = await sql.query(
    `select p.name,p.slug,s.status
     from public.store_subscriptions s
     left join public.tenant_plans p
       on p.tenant_id=s.tenant_id and p.id=s.tenant_plan_id
     where s.tenant_id=$1 and s.store_id=$2
     order by
       case when s.status in ('trialing','active','past_due','suspended') then 0 else 1 end,
       s.created_at desc
     limit 1`,
    [tenantId, storeId],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const status = row["status"];
  if (typeof status !== "string") throw new Error("Status de assinatura inválido");
  return { name: optionalText(row["name"]), slug: optionalText(row["slug"]), status };
}

const RECENT_ORDERS_SQL = `select id::text,order_number,status,customer_name,total_cents,created_at::text
  from public.orders where tenant_id=$1 and store_id=$2
  order by created_at desc,id desc limit 5`;

const TASK_ALERTS_SQL = `select id::text,title,priority,due_at::text
  from public.merchant_tasks where tenant_id=$1 and store_id=$2 and status='open'
  order by (due_at is null),due_at,
    case priority when 'high' then 0 when 'normal' then 1 else 2 end,
    created_at desc limit 5`;

const RECOVERY_ALERTS_SQL=`select j.id::text,j.kind,j.status,j.last_error,j.created_at::text,(j.payload->>'orderId') order_id from public.operational_jobs j where j.tenant_id=$1::uuid and j.store_id=$2::uuid and j.kind in ('store_payment.reconcile','shipment.recover') and j.status in ('retry','dead_letter') order by case when j.status='dead_letter' then 0 else 1 end,j.updated_at desc limit 8`;

const STOCK_ALERTS_SQL = `with inventory_rows as (
  select p.id as product_id,v.id as variant_id,p.name as product_name,
    v.name as variant_name,coalesce(sum(sm.delta),0)::integer as quantity
  from public.products p
  join public.product_variants v
    on v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id
  left join public.stock_movements sm
    on sm.tenant_id=v.tenant_id and sm.store_id=v.store_id
   and sm.product_id=v.product_id and sm.variant_id=v.id
  where p.tenant_id=$1 and p.store_id=$2 and p.active=true
    and p.track_inventory=true and v.active=true
  group by p.id,v.id,p.name,v.name
  union all
  select p.id,null::uuid,p.name,null::text,coalesce(sum(sm.delta),0)::integer
  from public.products p
  left join public.stock_movements sm
    on sm.tenant_id=p.tenant_id and sm.store_id=p.store_id
   and sm.product_id=p.id and sm.variant_id is null
  where p.tenant_id=$1 and p.store_id=$2 and p.active=true
    and p.track_inventory=true and not exists (
      select 1 from public.product_variants v
      where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id
    )
  group by p.id,p.name
)
select product_id::text,variant_id::text,product_name,variant_name,quantity
from inventory_rows where quantity<=5
order by quantity,product_name,variant_name nulls first limit 5`;

export async function loadMerchantDashboardActivity(
  sql: MerchantOpsSqlExecutor,
  scope: MerchantScope,
): Promise<MerchantDashboardActivity> {
  const params = [scope.tenantId, scope.storeId];
  const [orders, tasks, stock, recovery] = await Promise.all([
    sql.query(RECENT_ORDERS_SQL, params),
    sql.query(TASK_ALERTS_SQL, params),
    sql.query(STOCK_ALERTS_SQL, params),
    sql.query(RECOVERY_ALERTS_SQL,params),
  ]);
  return {
    recentOrders: orders.map((row) => ({
      id: requiredText(row["id"], "order.id"),
      orderNumber: integer(row, "order_number"),
      customerName: optionalText(row["customer_name"]),
      status: requiredText(row["status"], "order.status"),
      totalCents: integer(row, "total_cents"),
      createdAt: requiredText(row["created_at"], "order.created_at"),
    })),
    taskAlerts: tasks.map((row) => ({
      id: requiredText(row["id"], "task.id"),
      title: requiredText(row["title"], "task.title"),
      priority: requiredText(row["priority"], "task.priority"),
      dueAt: optionalText(row["due_at"]),
    })),
    recoveryAlerts: recovery.map((row)=>({id:requiredText(row["id"],"recovery.id"),kind:requiredText(row["kind"],"recovery.kind"),status:requiredText(row["status"],"recovery.status"),title:row["kind"]==="shipment.recover"?"Etiqueta precisa de atenção":"Pagamento em recuperação",detail:optionalText(row["last_error"])??"A recuperação automática está em andamento.",orderId:optionalText(row["order_id"]),createdAt:requiredText(row["created_at"],"recovery.created_at")})),
    stockAlerts: stock.map((row) => ({
      productId: requiredText(row["product_id"], "stock.product_id"),
      variantId: optionalText(row["variant_id"]),
      productName: requiredText(row["product_name"], "stock.product_name"),
      variantName: optionalText(row["variant_name"]),
      quantity: integer(row, "quantity"),
    })),
  };
}

export const getMerchantOperationsReport = createServerFn({ method: "GET" })
  .validator(reportRange)
  .handler(async ({ data }) => {
    const current = await createMerchantOperationsContext(getRequestHost());
    const defaults = defaultRange();
    return loadMerchantOperationsReport(current.sql, current.scope, data.from ?? defaults.from, data.to ?? defaults.to);
  });

export const getMerchantOperationsDashboard = createServerFn({ method: "GET" })
  .handler(async () => {
    const current = await createMerchantOperationsContext(getRequestHost());
    const catalog = createCatalogReadRepository(current.sql);
    const [metrics, settings, store, plan, activity] = await Promise.all([
      getMerchantDashboardMetrics(current.sql, current.scope),
      catalog.getSettings(current.scope),
      catalog.getStore(current.scope),
      getCurrentStorePlan(current.sql, current.scope.tenantId, current.scope.storeId),
      loadMerchantDashboardActivity(current.sql, current.scope),
    ]);
    if (!store) throw new Error("Loja não encontrada");
    return { store, metrics, plan, layout: settings.layout, activity };
  });
