import { getRequestHost } from "@tanstack/react-start/server";
import { assertCanManageTenantStores, canManageTenantStores } from "@white-label/auth";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createRealDeps, loadControl } from "./route-context.server.ts";

export interface ControlSql {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

export function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

export function numberValue(row: Record<string, unknown>, key: string): number {
  return Number(row[key] ?? 0);
}

async function context(requireAdmin: boolean) {
  const deps = await createRealDeps();
  const ctx = await loadControl({ host: getRequestHost() }, deps);
  if (requireAdmin) assertCanManageTenantStores({ tenantRoles: ctx.tenantRoles });
  return {
    actorUserId: String(ctx.userId),
    tenantId: String(ctx.tenantId),
    canManageTenantStores: canManageTenantStores({ tenantRoles: ctx.tenantRoles }),
    sql: createAdminSqlExecutor(),
  };
}

export async function controlMerchantRead() {
  return context(false);
}

export async function controlMerchantMutation() {
  return context(true);
}
