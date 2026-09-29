import { assertOrderScope } from "./validation.ts";
import type { OrderScope } from "./types.ts";
import type { OrderSqlExecutor } from "./repository.ts";

export interface MerchantDashboardMetrics {
  ordersToday: number;
  pendingOrders: number;
  revenuePeriodCents: number;
  validOrdersPeriod: number;
  averageTicketCents: number;
  activeProducts: number;
  lowStockProducts: number;
  customers: number;
  periodDays: number;
}

export function calculateAverageTicket(
  revenueCents: number,
  validOrders: number,
): number {
  if (validOrders <= 0) return 0;
  return Math.round(revenueCents / validOrders);
}

export async function getMerchantDashboardMetrics(
  sql: OrderSqlExecutor,
  scope: OrderScope,
): Promise<MerchantDashboardMetrics> {
  assertOrderScope(scope);
  const rows = await sql.query(
    `select
       (select count(*) from public.orders o
        where o.tenant_id=$1 and o.store_id=$2
          and o.created_at>=date_trunc('day',now()))::integer as orders_today,
       (select count(*) from public.orders o
        where o.tenant_id=$1 and o.store_id=$2 and o.status='pending')::integer as pending_orders,
       (select coalesce(sum(o.total_cents),0) from public.orders o
        where o.tenant_id=$1 and o.store_id=$2 and o.status='completed'
          and o.payment_status not in ('failed','refunded','cancelled')
          and coalesce(o.completed_at,o.updated_at)>=now()-interval '30 days')::bigint as revenue,
       (select count(*) from public.orders o
        where o.tenant_id=$1 and o.store_id=$2 and o.status='completed'
          and o.payment_status not in ('failed','refunded','cancelled')
          and coalesce(o.completed_at,o.updated_at)>=now()-interval '30 days')::integer as valid_orders,
       (select count(*) from public.products p
        where p.tenant_id=$1 and p.store_id=$2 and p.active=true)::integer as active_products,
       (select count(distinct p.id) from public.products p
        where p.tenant_id=$1 and p.store_id=$2 and p.active=true and p.track_inventory=true
          and (
            exists (
              select 1 from public.product_variants v
              where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id
                and coalesce((select sum(sm.delta) from public.stock_movements sm
                  where sm.tenant_id=v.tenant_id and sm.store_id=v.store_id
                    and sm.product_id=v.product_id and sm.variant_id=v.id),0)<=5
            )
            or (
              not exists (select 1 from public.product_variants v
                where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id)
              and coalesce((select sum(sm.delta) from public.stock_movements sm
                where sm.tenant_id=p.tenant_id and sm.store_id=p.store_id
                  and sm.product_id=p.id and sm.variant_id is null),0)<=5
            )
          ))::integer as low_stock_products,
       (select count(*) from public.customers c
        where c.tenant_id=$1 and c.store_id=$2)::integer as customers`,
    [scope.tenantId, scope.storeId],
  );
  if (rows.length === 0) throw new Error("Métricas indisponíveis");
  const row = rows[0];
  const revenue = Number(row["revenue"]);
  const validOrders = Number(row["valid_orders"]);
  return {
    ordersToday: Number(row["orders_today"]),
    pendingOrders: Number(row["pending_orders"]),
    revenuePeriodCents: revenue,
    validOrdersPeriod: validOrders,
    averageTicketCents: calculateAverageTicket(revenue, validOrders),
    activeProducts: Number(row["active_products"]),
    lowStockProducts: Number(row["low_stock_products"]),
    customers: Number(row["customers"]),
    periodDays: 30,
  };
}
