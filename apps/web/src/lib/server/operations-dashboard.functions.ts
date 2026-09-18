import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createCatalogReadRepository } from "@white-label/catalog";
import { getMerchantDashboardMetrics } from "@white-label/orders";
import { createMerchantOperationsContext } from "./operations-context.server.ts";

export const getMerchantOperationsDashboard = createServerFn({ method: "GET" })
  .handler(async () => {
    const current = await createMerchantOperationsContext(getRequestHost());
    const catalog = createCatalogReadRepository(current.sql);
    const [metrics, settings, store] = await Promise.all([
      getMerchantDashboardMetrics(current.sql, current.scope),
      catalog.getSettings(current.scope),
      catalog.getStore(current.scope),
    ]);
    if (!store) throw new Error("Loja não encontrada");
    return {
      store,
      metrics,
      layout: settings.layout,
    };
  });
