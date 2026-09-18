import { describe, expect, test } from "bun:test";
import {
  HttpError,
  loadControl,
} from "../../apps/web/src/lib/server/route-context.server.ts";
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
      await Promise.resolve();
      throw new Error("app.kataluu.com.br não deve consultar domínio dinâmico");
    },
  };
}

async function errorFor(memberships: MembershipRow[]): Promise<HttpError | null> {
  try {
    await loadControl({ host: "app.kataluu.com.br" }, deps(memberships));
    return null;
  } catch (error) {
    return error instanceof HttpError ? error : null;
  }
}

describe("system White Label control host", () => {
  test("permite exatamente uma White Label vinculada", async () => {
    const memberships: MembershipRow[] = [{
      tenantId: TENANT_A,
      tenantRoles: ["tenant_owner"],
      storeRoles: [],
    }];
    expect(await errorFor(memberships)).toBeNull();
  });

  test("nega usuário sem White Label vinculada com 403 explícito", async () => {
    const error = await errorFor([]);
    expect(error?.status).toBe(403);
    expect(error?.code).toBe("TENANT_UNRESOLVED");
  });

  test("mantém seleção explícita obrigatória quando há múltiplas White Labels", async () => {
    const memberships: MembershipRow[] = [
      { tenantId: TENANT_A, tenantRoles: ["tenant_owner"], storeRoles: [] },
      { tenantId: TENANT_B, tenantRoles: ["tenant_admin"], storeRoles: [] },
    ];
    const error = await errorFor(memberships);
    expect(error?.status).toBe(403);
    expect(error?.code).toBe("TENANT_SELECTION_REQUIRED");
  });
});
