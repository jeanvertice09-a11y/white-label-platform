import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createCatalogReadRepository } from "@white-label/catalog";
import { getMerchantDashboardMetrics } from "@white-label/orders";
import { createMerchantOperationsContext } from "./operations-context.server.ts";

interface PlanSummary {
  name: string | null;
  slug: string | null;
  status: string;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
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
  return {
    name: optionalText(row["name"]),
    slug: optionalText(row["slug"]),
    status,
  };
}

export const getMerchantOperationsDashboard = createServerFn({ method: "GET" })
  .handler(async () => {
    const current = await createMerchantOperationsContext(getRequestHost());
    const catalog = createCatalogReadRepository(current.sql);
    const [metrics, settings, store, plan] = await Promise.all([
      getMerchantDashboardMetrics(current.sql, current.scope),
      catalog.getSettings(current.scope),
      catalog.getStore(current.scope),
      getCurrentStorePlan(current.sql, current.scope.tenantId, current.scope.storeId),
    ]);
    if (!store) throw new Error("Loja não encontrada");
    return {
      store,
      metrics,
      plan,
      layout: settings.layout,
    };
  });
