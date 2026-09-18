import { getRequestHost } from "@tanstack/react-start/server";
import { assertCanManageWhiteLabels } from "@white-label/auth";
import type { DomainType } from "@white-label/domains";
import type { JsonObject } from "./master-white-label.types.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createRealDeps, loadMaster } from "./route-context.server.ts";

export interface AdminSql { query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>; }
export function text(row: Record<string, unknown>, key: string): string { const value = row[key]; return typeof value === "string" ? value : ""; }
export function nullableText(row: Record<string, unknown>, key: string): string | null { const value = row[key]; return typeof value === "string" ? value : null; }
export function numberValue(row: Record<string, unknown>, key: string): number { const value = row[key]; return typeof value === "number" ? value : Number(value ?? 0); }
export function boolValue(row: Record<string, unknown>, key: string): boolean { return row[key] === true; }
export function objectValue(row: Record<string, unknown>, key: string): JsonObject {
  const value = row[key];
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}
export async function masterRead(): Promise<{ actorUserId: string; sql: AdminSql }> {
  const deps = await createRealDeps(); const ctx = await loadMaster({ host: getRequestHost() }, deps);
  return { actorUserId: String(ctx.userId), sql: createAdminSqlExecutor() };
}
export async function masterMutation(): Promise<{ actorUserId: string; sql: AdminSql }> {
  const deps = await createRealDeps(); const ctx = await loadMaster({ host: getRequestHost() }, deps);
  assertCanManageWhiteLabels({ platformRoles: ctx.platformRoles });
  return { actorUserId: String(ctx.userId), sql: createAdminSqlExecutor() };
}
export function assertDomainScope(type: DomainType, storeId: string | null): void {
  const storeDomain = type === "store_admin" || type === "store_catalog";
  if (storeDomain && !storeId) throw new Error("Domínio de loja exige storeId.");
  if (!storeDomain && storeId) throw new Error("Domínio da White Label não pode receber storeId.");
}
export async function hostnameTaken(sql: AdminSql, hostname: string, ignoreDomainId?: string): Promise<boolean> {
  const rows = await sql.query(`select exists(select 1 from public.domains where hostname=$1 and ($2::uuid is null or id<>$2::uuid)) as taken`, [hostname, ignoreDomainId ?? null]);
  return rows[0]?.["taken"] === true;
}
