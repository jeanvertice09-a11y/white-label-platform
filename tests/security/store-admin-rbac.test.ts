import { describe, expect, test } from "bun:test";
import {
  HttpError,
  loadStoreAdmin,
} from "../../apps/web/src/lib/server/route-context.server.ts";
import type { RouteDeps } from "../../apps/web/src/lib/server/route-context.server.ts";
import { stubSession } from "../../apps/web/src/lib/server/session.server.ts";
import type { MembershipRow, StoreId, TenantId } from "../../packages/tenant/src/index.ts";
import type { StoreRole } from "../../packages/auth/src/roles.ts";

const USER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as TenantId;
const STORE = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa" as StoreId;

function deps(role: StoreRole): RouteDeps {
  const memberships: MembershipRow[] = [{
    tenantId: TENANT,
    storeId: STORE,
    tenantRoles: [],
    storeRoles: [role],
  }];
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
      return { tenantId: TENANT, storeId: STORE, type: "store_admin" };
    },
  };
}

async function expectForbidden(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
    throw new Error("Esperava 403");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(403);
  }
}

describe("store admin RBAC", () => {
  for (const role of ["store_owner", "store_admin", "store_manager"] as const) {
    test(`${role} pode entrar no boundary administrativo da store`, async () => {
      const context = await loadStoreAdmin({ host: "admin.example.com" }, deps(role));
      expect(context.storeId).toBe(STORE);
      expect(context.storeRoles).toContain(role);
    });
  }

  test("store_staff não recebe autoridade para mutações administrativas", async () => {
    await expectForbidden(loadStoreAdmin({ host: "admin.example.com" }, deps("store_staff")));
  });
});
