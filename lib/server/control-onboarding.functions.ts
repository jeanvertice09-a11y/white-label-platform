import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createRealDeps, loadControl } from "./route-context.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { loadControlOnboarding } from "./control-onboarding.server.ts";

export const getControlOnboarding = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await loadControl({ host: getRequestHost() }, await createRealDeps());
  return loadControlOnboarding(createAdminSqlExecutor(), String(ctx.tenantId));
});
