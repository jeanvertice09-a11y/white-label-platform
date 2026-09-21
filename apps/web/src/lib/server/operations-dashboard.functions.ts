import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createCatalogReadRepository } from "@white-label/catalog";
import { getMerchantDashboardMetrics } from "@white-label/orders";
import { createMerchantOperationsContext } from "./operations-context.server.ts";
import { loadStoreCommercialPlanSummary } from "./operations-dashboard-plan.server.ts";

export const getMerchantOperationsDashboard = createServerFn({ method: "GET" })
  .handler(async () => {
    const current = await createMerchantOperationsContext(getRequestHost());
    const catalog = createCatalogReadRepository(current.sql);
    const [metrics, settings, store, plan] = await Promise.all([
      getMerchantDashboardMetrics(current.sql, current.scope),
      catalog.getSettings(current.scope),
      catalog.getStore(current.scope),
      loadStoreCommercialPlanSummary(current.sql, current.scope),
    ]);
    if (!store) throw new Error("Loja não encontrada");
    return {
      store,
      metrics,
      plan,
      layout: settings.layout,
    };
  });
