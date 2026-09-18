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

async function getCurrentPlan(
  sql: { query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> },
  tenantId: string,
): Promise<PlanSummary | null> {
  const rows = await sql.query(
    `select p.name,p.slug,s.status
     from public.subscriptions s
     left join public.plans p on p.id=s.plan_id
     where s.tenant_id=$1 and s.level='tenant_billing'
     order by s.created_at desc limit 1`,
    [tenantId],
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
      getCurrentPlan(current.sql, current.scope.tenantId),
    ]);
    if (!store) throw new Error("Loja não encontrada");
    return {
      store,
      metrics,
      plan,
      layout: settings.layout,
    };
  });
