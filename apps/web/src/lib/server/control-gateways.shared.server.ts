import { getRequestHost } from "@tanstack/react-start/server";
import {
  assertCanManageTenantGateways,
  canManageTenantGateways,
} from "@white-label/auth";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createRealDeps, loadControl } from "./route-context.server.ts";

async function context(requireAdmin: boolean) {
  const deps = await createRealDeps();
  const ctx = await loadControl({ host: getRequestHost() }, deps);
  const roles = { tenantRoles: ctx.tenantRoles };
  if (requireAdmin) assertCanManageTenantGateways(roles);
  return {
    actorUserId: String(ctx.userId),
    tenantId: String(ctx.tenantId),
    canManage: canManageTenantGateways(roles),
    sql: createAdminSqlExecutor(),
  };
}

export async function controlGatewayRead() {
  return context(false);
}

export async function controlGatewayMutation() {
  return context(true);
}
