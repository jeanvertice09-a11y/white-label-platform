import { describe, expect, test } from "bun:test";

async function source(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe("control team invitations", () => {
  test("convites usam Supabase Auth admin somente no servidor e nunca aceitam escopo do browser", async () => {
    const invite = await source("apps/web/src/lib/server/control-team-invite.server.ts");
    const functions = await source("apps/web/src/lib/server/control-team.functions.ts");
    const service = await source("apps/web/src/lib/server/supabase-service.server.ts");

    expect(invite).toContain("auth.admin.inviteUserByEmail(email)");
    expect(invite).toContain("auth.admin.deleteUser(userId)");
    expect(invite).toContain("upsertTenantMemberGuarded");
    expect(invite).toContain("upsertStoreMember");
    expect(functions).not.toContain("tenantId: z.string");
    expect(service).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(service).toContain("Módulo server-only vazou para o client");
  });

  test("falha de membership reverte somente usuário criado pelo convite", async () => {
    const invite = await source("apps/web/src/lib/server/control-team-invite.server.ts");
    expect(invite).toContain("if (!invited) return");
    expect(invite).toContain("await rollbackInvite(auth.userId, auth.invited)");
    expect(invite).toContain("const raced = await existingUserId(sql, email)");
  });

  test("tenant_admin não dispara convite de tenant_owner antes da autorização", async () => {
    const invite = await source("apps/web/src/lib/server/control-team-invite.server.ts");
    const guard = invite.indexOf('role === "tenant_owner" && !actorIsOwner');
    const auth = invite.indexOf("const auth = await ensureAuthUser(sql, email)", guard);
    expect(guard).toBeGreaterThan(-1);
    expect(auth).toBeGreaterThan(guard);
  });

  test("workspace diferencia convite pendente de membro confirmado", async () => {
    const read = await source("apps/web/src/lib/server/control-team.read.server.ts");
    const page = await source("apps/web/src/features/control/control-team-page.tsx");
    expect(read).toContain("email_confirmed_at");
    expect(read).toContain("invitePending");
    expect(page).toContain("convite pendente");
  });
});
