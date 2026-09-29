import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createStoreAdminRequestDeps, loadStoreAdmin } from "./route-context.server.ts";

function requireHost(rawHost: string | null): string {
  if (!rawHost) throw new Error("Hostname não resolvido");
  return rawHost.toLowerCase().split(":")[0]?.replace(/\.$/, "") ?? rawHost;
}

export async function createMerchantOperationsContext(rawHost: string | null) {
  const host = requireHost(rawHost);
  const deps = await createStoreAdminRequestDeps();
  const auth = await loadStoreAdmin({ host }, deps);
  if (!auth.storeId) throw new Error("Loja não resolvida");
  return {
    scope: {
      tenantId: String(auth.tenantId),
      storeId: String(auth.storeId),
    },
    userId: String(auth.userId),
    sql: createAdminSqlExecutor(),
  };
}
