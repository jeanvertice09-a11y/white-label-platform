import type { StoreRole, TenantRole } from "@white-label/auth";
import type { ControlTeamSql } from "./control-team.shared.server.ts";
import type { ControlTeamWorkspace } from "./control-team.types.ts";

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Coluna inválida: ${key}`);
  return value;
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

export async function loadControlTeamWorkspace(
  sql: ControlTeamSql,
  tenantId: string,
  canManage: boolean,
  canManageOwners: boolean,
): Promise<ControlTeamWorkspace> {
  const [tenantRows, storeRows, stores] = await Promise.all([
    sql.query(
      `select tm.user_id::text, u.email::text, tm.role, tm.created_at::text
       from public.tenant_members tm
       left join auth.users u on u.id=tm.user_id
       where tm.tenant_id=$1::uuid
       order by tm.created_at,tm.user_id`,
      [tenantId],
    ),
    sql.query(
      `select sm.user_id::text,u.email::text,sm.store_id::text,s.name store_name,
              sm.role,sm.created_at::text
       from public.store_members sm
       join public.stores s on s.tenant_id=sm.tenant_id and s.id=sm.store_id
       left join auth.users u on u.id=sm.user_id
       where sm.tenant_id=$1::uuid
       order by s.name,sm.created_at,sm.user_id`,
      [tenantId],
    ),
    sql.query(
      `select id::text,name from public.stores
       where tenant_id=$1::uuid
       order by name,id`,
      [tenantId],
    ),
  ]);
  return {
    canManage,
    canManageOwners,
    tenantMembers: tenantRows.map((row) => ({
      userId: text(row, "user_id"),
      email: nullableText(row, "email"),
      role: text(row, "role") as TenantRole,
      createdAt: text(row, "created_at"),
    })),
    storeMembers: storeRows.map((row) => ({
      userId: text(row, "user_id"),
      email: nullableText(row, "email"),
      storeId: text(row, "store_id"),
      storeName: text(row, "store_name"),
      role: text(row, "role") as StoreRole,
      createdAt: text(row, "created_at"),
    })),
    stores: stores.map((row) => ({ id: text(row, "id"), name: text(row, "name") })),
  };
}
