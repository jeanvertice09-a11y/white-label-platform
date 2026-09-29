import type { StoreRole, TenantRole } from "@white-label/auth";
import { createServiceSupabaseClient } from "./supabase-service.server.ts";
import type { ControlTeamSql } from "./control-team.shared.server.ts";
import { upsertStoreMember } from "./control-team.write.server.ts";
import { upsertTenantMemberGuarded } from "./control-team-tenant-guard.server.ts";

interface InviteResult {
  userId: string;
  invited: boolean;
}

async function existingUserId(sql: ControlTeamSql, email: string): Promise<string | null> {
  const rows = await sql.query(
    "select id::text from auth.users where lower(email)=lower($1) limit 1",
    [email],
  );
  const value = rows.at(0)?.["id"];
  return typeof value === "string" ? value : null;
}

async function ensureAuthUser(sql: ControlTeamSql, email: string): Promise<InviteResult> {
  const existing = await existingUserId(sql, email);
  if (existing) return { userId: existing, invited: false };

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
  if (error) {
    const raced = await existingUserId(sql, email);
    if (raced) return { userId: raced, invited: false };
    throw new Error(error.message);
  }
  if (!data.user.id) throw new Error("Supabase Auth não retornou o usuário convidado.");
  return { userId: data.user.id, invited: true };
}

async function rollbackInvite(userId: string, invited: boolean): Promise<void> {
  if (!invited) return;
  const { error } = await createServiceSupabaseClient().auth.admin.deleteUser(userId);
  if (error) console.error("[control-team] falha ao reverter usuário convidado sem membership", { userId });
}

export async function inviteTenantMember(
  sql: ControlTeamSql,
  tenantId: string,
  actorUserId: string,
  actorIsOwner: boolean,
  email: string,
  role: TenantRole,
): Promise<{ userId: string; role: TenantRole; invited: boolean }> {
  if (role === "tenant_owner" && !actorIsOwner) {
    throw new Error("Somente tenant_owner pode convidar outro tenant_owner.");
  }
  const auth = await ensureAuthUser(sql, email);
  try {
    const member = await upsertTenantMemberGuarded(
      sql,
      tenantId,
      actorUserId,
      actorIsOwner,
      email,
      role,
    );
    return { ...member, invited: auth.invited };
  } catch (error) {
    await rollbackInvite(auth.userId, auth.invited);
    throw error;
  }
}

export async function inviteStoreMember(
  sql: ControlTeamSql,
  tenantId: string,
  actorUserId: string,
  storeId: string,
  email: string,
  role: Exclude<StoreRole, "store_owner">,
): Promise<{ userId: string; role: StoreRole; invited: boolean }> {
  const auth = await ensureAuthUser(sql, email);
  try {
    const member = await upsertStoreMember(sql, tenantId, actorUserId, storeId, email, role);
    return { ...member, invited: auth.invited };
  } catch (error) {
    await rollbackInvite(auth.userId, auth.invited);
    throw error;
  }
}
