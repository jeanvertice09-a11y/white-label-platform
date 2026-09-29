import type { MembershipReader } from "./route-context.server.ts";
import type { PlatformRole, StoreRole, TenantRole } from "@white-label/auth";
import type { MembershipRow, StoreId, TenantId } from "@white-label/tenant";
import type { SqlExecutor } from "@white-label/domains";

interface TenantRow {
  tenant_id: string;
  role: string;
}
interface StoreRow {
  tenant_id: string;
  store_id: string;
  role: string;
}

function str(v: unknown): string {
  if (typeof v !== "string") throw new Error("coluna inválida do banco");
  return v;
}

/**
 * Leitor de memberships via PostgreSQL com service_role (servidor).
 * Agrega tenant_members + store_members por tenant para o TenantContext.
 * Conexão (Supabase local, porta 54322) pendente de backend; executor injetado.
 */
export function createDbMembershipReader(sql: SqlExecutor): MembershipReader {
  return {
    async getPlatformRoles(userId: string): Promise<PlatformRole[]> {
      const rows = await sql.query(
        `select role from public.platform_members where user_id = $1`,
        [userId],
      );
      return rows.map((r) => str(r["role"]) as PlatformRole);
    },
    async getTenantMemberships(userId: string): Promise<MembershipRow[]> {
      const tenantRows = await sql.query(
        `select tenant_id, role from public.tenant_members where user_id = $1`,
        [userId],
      );
      const storeRows = await sql.query(
        `select tenant_id, store_id, role from public.store_members where user_id = $1`,
        [userId],
      );
      const tenants: TenantRow[] = tenantRows.map((r) => ({
        tenant_id: str(r["tenant_id"]),
        role: str(r["role"]),
      }));
      const stores: StoreRow[] = storeRows.map((r) => ({
        tenant_id: str(r["tenant_id"]),
        store_id: str(r["store_id"]),
        role: str(r["role"]),
      }));
      const byKey = new Map<string, MembershipRow>();
      for (const t of tenants) {
        const cur = byKey.get(t.tenant_id);
        const role = t.role as TenantRole;
        if (cur) cur.tenantRoles.push(role);
        else {
          byKey.set(t.tenant_id, {
            tenantId: t.tenant_id as TenantId,
            tenantRoles: [role],
            storeRoles: [],
          });
        }
      }
      for (const s of stores) {
        const key = `${s.tenant_id}:${s.store_id}`;
        const cur = byKey.get(key);
        const role = s.role as StoreRole;
        if (cur) cur.storeRoles.push(role);
        else {
          byKey.set(key, {
            tenantId: s.tenant_id as TenantId,
            storeId: s.store_id as StoreId,
            tenantRoles: [],
            storeRoles: [role],
          });
        }
      }
      return [...byKey.values()];
    },
  };
}
