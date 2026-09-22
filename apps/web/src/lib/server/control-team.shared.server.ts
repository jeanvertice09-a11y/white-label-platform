import { getRequestHost } from "@tanstack/react-start/server";
import { assertCanManageTenantTeam, canManageTenantTeam } from "@white-label/auth";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createRealDeps, loadControl } from "./route-context.server.ts";

export interface ControlTeamSql {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

async function context(requireAdmin: boolean) {
  const deps = await createRealDeps();
  const ctx = await loadControl({ host: getRequestHost() }, deps);
  if (requireAdmin) assertCanManageTenantTeam({ tenantRoles: ctx.tenantRoles });
  return {
    actorUserId: String(ctx.userId),
    tenantId: String(ctx.tenantId),
    actorIsOwner: ctx.tenantRoles.includes("tenant_owner"),
    canManage: canManageTenantTeam({ tenantRoles: ctx.tenantRoles }),
    sql: createAdminSqlExecutor(),
  };
}

export async function controlTeamRead() {
  return context(false);
}

export async function controlTeamMutation() {
  return context(true);
}
