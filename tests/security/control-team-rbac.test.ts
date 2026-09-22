import { describe, expect, test } from "bun:test";
import { HttpError, loadControl } from "../../apps/web/src/lib/server/route-context.server.ts";
import type { RouteDeps } from "../../apps/web/src/lib/server/route-context.server.ts";
import { stubSession } from "../../apps/web/src/lib/server/session.server.ts";
import type { MembershipRow, TenantId } from "../../packages/tenant/src/index.ts";
import {
  AuthorizationError,
  assertCanManageTenantTeam,
  canManageTenantTeam,
} from "../../packages/auth/src/index.ts";

async function source(path: string): Promise<string> { return Bun.file(path).text(); }

describe("control team RBAC", () => {
  test("somente tenant_owner/admin podem mutar equipe", () => {
    expect(canManageTenantTeam({ tenantRoles: ["tenant_owner"] })).toBe(true);
    expect(canManageTenantTeam({ tenantRoles: ["tenant_admin"] })).toBe(true);
    expect(canManageTenantTeam({ tenantRoles: ["tenant_finance"] })).toBe(false);
    expect(canManageTenantTeam({ tenantRoles: ["tenant_support"] })).toBe(false);
    expect(() => {
      assertCanManageTenantTeam({ tenantRoles: ["tenant_support"] });
    }).toThrow(AuthorizationError);
  });

  test("server functions derivam tenant do contexto e não aceitam tenantId do browser", async () => {
    const functions = await source("apps/web/src/lib/server/control-team.functions.ts");
    const shared = await source("apps/web/src/lib/server/control-team.shared.server.ts");
    expect(shared).toContain("loadControl({ host: getRequestHost() }, deps)");
    expect(shared).toContain("String(ctx.tenantId)");
    expect(functions).not.toContain("tenantId: z.string");
    expect(functions).not.toContain("actorIsOwner: z.");
  });

  test("queries de loja exigem tenant + store e owner da loja não é mutado neste fluxo", async () => {
    const write = await source("apps/web/src/lib/server/control-team.write.server.ts");
    expect(write).toContain("tenant_id=$1::uuid and id=$2::uuid");
    expect(write).toContain("tenant_id=$1::uuid and store_id=$2::uuid and user_id=$3::uuid");
    expect(write).toContain("role<>'store_owner'");
    expect(write).toContain("fluxo dedicado de responsável da loja");
  });

  test("protege tenant_owner contra escalada e remoção do último owner", async () => {
    const write = await source("apps/web/src/lib/server/control-team.write.server.ts");
    expect(write).toContain("Somente tenant_owner pode administrar outro tenant_owner.");
    expect(write).toContain("A White Label precisa manter pelo menos um tenant_owner.");
    expect(write).toContain("$4::boolean or $3<>'tenant_owner'");
    expect(write).toContain("role='tenant_owner'");
  });

  test("acesso é negado no request seguinte após remoção da membership", async () => {
    const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as TenantId;
    let memberships: MembershipRow[] = [{
      tenantId,
      tenantRoles: ["tenant_admin"],
      storeRoles: [],
    }];
    const deps: RouteDeps = {
      resolveSession: async () => {
        await Promise.resolve();
        return stubSession("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
      },
      memberships: {
        getPlatformRoles: async () => {
          await Promise.resolve();
          return [];
        },
        getTenantMemberships: async () => {
          await Promise.resolve();
          return memberships;
        },
      },
      resolveTenantForHost: async () => {
        await Promise.resolve();
        return {
          tenantId,
          storeId: null,
          type: "tenant_panel",
        };
      },
      getTenantStatus: async () => {
        await Promise.resolve();
        return "active";
      },
    };
    const activeContext = await loadControl({ host: "tenant.example.com" }, deps);
    expect(activeContext).toBeDefined();
    memberships = [];
    try {
      await loadControl({ host: "tenant.example.com" }, deps);
      throw new Error("request deveria ter sido negado");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(403);
    }
  });

  test("RLS continua self-read e sem policy de escrita autenticada", async () => {
    const rls = await source("supabase/migrations/0005_membership_self_read.sql");
    expect(rls).toContain("using (user_id = auth.uid())");
    expect(rls).not.toContain("for update");
    expect(rls).not.toContain("for delete");
    expect(rls).not.toContain("for insert");
  });
});
