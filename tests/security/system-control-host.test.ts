import { describe, expect, test } from "bun:test";
import { loadControl } from "../../apps/web/src/lib/server/route-context.server.ts";
import type { RouteDeps } from "../../apps/web/src/lib/server/route-context.server.ts";
import { stubSession } from "../../apps/web/src/lib/server/session.server.ts";
import type { MembershipRow, TenantId } from "../../packages/tenant/src/index.ts";

const USER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as TenantId;
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as TenantId;

function deps(memberships: MembershipRow[]): RouteDeps {
  return {
    resolveSession: async () => {
      await Promise.resolve();
      return stubSession(USER);
    },
    memberships: {
      async getPlatformRoles() {
        await Promise.resolve();
        return [];
      },
      async getTenantMemberships() {
        await Promise.resolve();
        return memberships;
      },
    },
    resolveTenantForHost: async () => {
      throw new Error("app.kataluu.com.br não deve consultar domínio dinâmico");
    },
  };
}

async function canOpen(memberships: MembershipRow[]): Promise<boolean> {
  try {
    await loadControl({ host: "app.kataluu.com.br" }, deps(memberships));
    return true;
  } catch {
    return false;
  }
}

describe("system White Label control host", () => {
  test("permite exatamente uma White Label vinculada", async () => {
    const memberships: MembershipRow[] = [{
      tenantId: TENANT_A,
      tenantRoles: ["tenant_owner"],
      storeRoles: [],
    }];
    expect(await canOpen(memberships)).toBe(true);
  });

  test("nega usuário sem White Label vinculada", async () => {
    expect(await canOpen([])).toBe(false);
  });

  test("nega seleção ambígua quando há mais de uma White Label", async () => {
    const memberships: MembershipRow[] = [
      { tenantId: TENANT_A, tenantRoles: ["tenant_owner"], storeRoles: [] },
      { tenantId: TENANT_B, tenantRoles: ["tenant_admin"], storeRoles: [] },
    ];
    expect(await canOpen(memberships)).toBe(false);
  });
});
