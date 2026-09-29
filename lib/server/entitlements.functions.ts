import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { loadStoreEntitlementSnapshot } from "@white-label/billing";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createRealDeps, loadStoreAdmin } from "./route-context.server.ts";

export const getCurrentStoreEntitlements = createServerFn({ method: "GET" }).handler(async () => {
  const deps = await createRealDeps();
  const ctx = await loadStoreAdmin({ host: getRequestHost() }, deps);
  if (!ctx.storeId) throw new Error("Loja não resolvida");
  return loadStoreEntitlementSnapshot(createAdminSqlExecutor(), {
    tenantId: String(ctx.tenantId),
    storeId: String(ctx.storeId),
  });
});
