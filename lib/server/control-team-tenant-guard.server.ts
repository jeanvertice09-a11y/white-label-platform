import type { TenantRole } from "@white-label/auth";
import type { ControlTeamSql } from "./control-team.shared.server.ts";

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

async function resolveUserIdByEmail(sql: ControlTeamSql, email: string): Promise<string> {
  const rows = await sql.query(
    "select id::text from auth.users where lower(email)=lower($1) limit 1",
    [email],
  );
  const userId = text(rows[0] ?? {}, "id");
  if (!userId) throw new Error("Usuário não existe no Supabase Auth.");
  return userId;
}

/**
 * Boundary transacional para memberships de tenant.
 * A função SQL de 0029 adquire lock no tenant antes de revalidar o ator,
 * contar owners e mutar, impedindo duas requisições concorrentes de
 * remover/rebaixar todos os tenant_owner.
 */
export async function upsertTenantMemberGuarded(
  sql: ControlTeamSql,
  tenantId: string,
  actorUserId: string,
  actorIsOwner: boolean,
  email: string,
  role: TenantRole,
): Promise<{ userId: string; role: TenantRole }> {
  const targetUserId = await resolveUserIdByEmail(sql, email);
  const rows = await sql.query(
    `select user_id::text,role
     from public.control_upsert_tenant_member_guarded(
       $1::uuid,$2::uuid,$3::text,$4::uuid,$5::boolean
     )`,
    [tenantId, targetUserId, role, actorUserId, actorIsOwner],
  );
  const row = rows.at(0);
  if (!row) throw new Error("Não foi possível alterar a membership.");
  return { userId: text(row, "user_id"), role: text(row, "role") as TenantRole };
}

export async function removeTenantMemberGuarded(
  sql: ControlTeamSql,
  tenantId: string,
  actorUserId: string,
  actorIsOwner: boolean,
  userId: string,
): Promise<{ ok: true }> {
  const rows = await sql.query(
    `select user_id::text,role
     from public.control_remove_tenant_member_guarded(
       $1::uuid,$2::uuid,$3::uuid,$4::boolean
     )`,
    [tenantId, userId, actorUserId, actorIsOwner],
  );
  if (!rows.at(0)) throw new Error("Não foi possível remover a membership.");
  return { ok: true };
}
