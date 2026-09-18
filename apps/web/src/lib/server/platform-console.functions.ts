import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { loadMasterConsoleDataHttp } from "./platform-console.master-http.server.ts";
import { loadTenantControlData } from "./platform-console.control.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createServiceSupabaseClient } from "./supabase-service.server.ts";
import { createRealDeps, loadControl, loadMaster } from "./route-context.server.ts";

export const getMasterConsoleData = createServerFn({ method: "GET" }).handler(async () => {
  const deps = await createRealDeps();
  await loadMaster({ host: getRequestHost() }, deps);
  return loadMasterConsoleDataHttp(createServiceSupabaseClient());
});

export const getTenantControlDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const deps = await createRealDeps();
  const ctx = await loadControl({ host: getRequestHost() }, deps);
  return loadTenantControlData(createAdminSqlExecutor(), String(ctx.tenantId));
});
