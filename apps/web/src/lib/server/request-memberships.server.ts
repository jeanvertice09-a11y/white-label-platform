import type { PlatformRole, StoreRole, TenantRole } from "@white-label/auth";
import type { MembershipRow, StoreId, TenantId } from "@white-label/tenant";
import type { MembershipReader } from "./route-context.server.ts";
import { createRequestSupabaseClient } from "./supabase-server.server.ts";

interface TenantMemberRow {
  tenant_id: string;
  role: string;
}

interface StoreMemberRow {
  tenant_id: string;
  store_id: string;
  role: string;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Membership inválida: ${field}`);
  return value;
}

function mapMemberships(
  tenantRows: TenantMemberRow[],
  storeRows: StoreMemberRow[],
): MembershipRow[] {
  const rows = new Map<string, MembershipRow>();
  for (const item of tenantRows) {
    const tenantId = item.tenant_id as TenantId;
    const current = rows.get(item.tenant_id);
    if (current) current.tenantRoles.push(item.role as TenantRole);
    else rows.set(item.tenant_id, { tenantId, tenantRoles: [item.role as TenantRole], storeRoles: [] });
  }
  for (const item of storeRows) {
    const key = `${item.tenant_id}:${item.store_id}`;
    const current = rows.get(key);
    if (current) current.storeRoles.push(item.role as StoreRole);
    else rows.set(key, {
      tenantId: item.tenant_id as TenantId,
      storeId: item.store_id as StoreId,
      tenantRoles: [],
      storeRoles: [item.role as StoreRole],
    });
  }
  return [...rows.values()];
}

/** Lê somente as memberships do usuário autenticado. RLS exige user_id = auth.uid(). */
export function createRequestMembershipReader(): MembershipReader {
  const client = createRequestSupabaseClient();
  return {
    async getPlatformRoles(userId: string): Promise<PlatformRole[]> {
      const { data, error } = await client
        .from("platform_members")
        .select("role")
        .eq("user_id", userId);
      if (error) throw new Error("Falha ao consultar permissões da plataforma");
      return (data ?? []).map((row) => requireString(row.role, "role") as PlatformRole);
    },
    async getTenantMemberships(userId: string): Promise<MembershipRow[]> {
      const [tenantResult, storeResult] = await Promise.all([
        client.from("tenant_members").select("tenant_id,role").eq("user_id", userId),
        client.from("store_members").select("tenant_id,store_id,role").eq("user_id", userId),
      ]);
      if (tenantResult.error || storeResult.error) {
        throw new Error("Falha ao consultar permissões do usuário");
      }
      const tenants: TenantMemberRow[] = (tenantResult.data ?? []).map((row) => ({
        tenant_id: requireString(row.tenant_id, "tenant_id"),
        role: requireString(row.role, "role"),
      }));
      const stores: StoreMemberRow[] = (storeResult.data ?? []).map((row) => ({
        tenant_id: requireString(row.tenant_id, "tenant_id"),
        store_id: requireString(row.store_id, "store_id"),
        role: requireString(row.role, "role"),
      }));
      return mapMemberships(tenants, stores);
    },
  };
}
