import { describe, expect, test } from "bun:test";
import { HttpError, loadStoreAdmin } from "../../apps/web/src/lib/server/route-context.server.ts";
import type { RouteDeps } from "../../apps/web/src/lib/server/route-context.server.ts";
import { stubSession } from "../../apps/web/src/lib/server/session.server.ts";
import { asStoreId, asTenantId } from "../../packages/tenant/src/index.ts";

const USER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT = asTenantId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const STORE = asStoreId("aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa");

function deps(storeStatus: "active" | "suspended", tenantStatus = "active"): RouteDeps {
  return {
    resolveSession: async () => {
      await Promise.resolve();
      return stubSession(USER);
    },
    memberships: {
      async getPlatformRoles() { await Promise.resolve(); return []; },
      async getTenantMemberships() {
        await Promise.resolve();
        return [{
          tenantId: TENANT,
          storeId: STORE,
          tenantRoles: [],
          storeRoles: ["store_admin" as const],
        }];
      },
    },
    resolveTenantForHost: async () => {
      await Promise.resolve();
      return { tenantId: TENANT, storeId: STORE, type: "store_admin" };
    },
    getTenantStatus: async () => {
      await Promise.resolve();
      return tenantStatus;
    },
    getStoreStatus: async () => {
      await Promise.resolve();
      return storeStatus;
    },
  };
}

async function errorFor(input: RouteDeps): Promise<HttpError | null> {
  try {
    await loadStoreAdmin({ host: "admin.example.test" }, input);
    return null;
  } catch (error) {
    return error instanceof HttpError ? error : null;
  }
}

describe("fase 05 store operational guard", () => {
  test("store ativa mantém acesso ao /admin", async () => {
    expect(await errorFor(deps("active"))).toBeNull();
  });

  test("store suspensa perde acesso ao /admin", async () => {
    const error = await errorFor(deps("suspended"));
    expect(error?.status).toBe(403);
    expect(error?.code).toBe("STORE_SUSPENDED");
  });

  test("tenant suspenso continua bloqueando /admin", async () => {
    const error = await errorFor(deps("active", "suspended"));
    expect(error?.status).toBe(403);
    expect(error?.code).toBe("TENANT_SUSPENDED");
  });
});
