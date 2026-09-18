import { describe, expect, test } from "bun:test";
import {
  HttpError,
  loadControl,
  loadMaster,
  loadStoreAdmin,
} from "../../apps/web/src/lib/server/route-context.server.ts";
import type { RouteDeps } from "../../apps/web/src/lib/server/route-context.server.ts";
import { stubSession } from "../../apps/web/src/lib/server/session.server.ts";
import type { MembershipRow, StoreId, TenantId } from "../../packages/tenant/src/index.ts";

const USER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as TenantId;
const STORE = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa" as StoreId;

function deps(overrides: Partial<RouteDeps> = {}): RouteDeps {
  return {
    resolveSession: async () => {
      await Promise.resolve();
      return null;
    },
    memberships: {
      async getPlatformRoles() {
        await Promise.resolve();
        return [];
      },
      async getTenantMemberships() {
        await Promise.resolve();
        return [];
      },
    },
    resolveTenantForHost: async () => {
      await Promise.resolve();
      return null;
    },
    ...overrides,
  };
}

function authenticated(memberships: MembershipRow[] = []): RouteDeps {
  return deps({
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
  });
}

async function expectHttpError(
  promise: Promise<unknown>,
  status: number,
  code: string,
): Promise<void> {
  try {
    await promise;
    throw new Error("Esperava HttpError");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    const http = error as HttpError;
    expect(http.status).toBe(status);
    expect(http.code).toBe(code);
  }
}

describe("route error semantics", () => {
  test("sem sessão continua 401", async () => {
    await expectHttpError(
      loadMaster({ host: "control.geral.kataluu.com.br" }, deps()),
      401,
      "UNAUTHENTICATED",
    );
  });

  test("usuário autenticado sem role master continua 403", async () => {
    await expectHttpError(
      loadMaster({ host: "control.geral.kataluu.com.br" }, authenticated()),
      403,
      "FORBIDDEN",
    );
  });

  test("erro interno de membership vira 500, nunca 403", async () => {
    const broken = authenticated();
    broken.memberships.getPlatformRoles = async () => {
      await Promise.resolve();
      throw new Error("database unavailable");
    };
    await expectHttpError(
      loadMaster({ host: "control.geral.kataluu.com.br" }, broken),
      500,
      "AUTH_INTERNAL_ERROR",
    );
  });

  test("host desconhecido autenticado recebe 404", async () => {
    await expectHttpError(
      loadControl({ host: "unknown.example.com" }, authenticated()),
      404,
      "HOST_NOT_FOUND",
    );
  });

  test("tenant_site não autoriza /control", async () => {
    const user = authenticated([{ tenantId: TENANT, tenantRoles: ["tenant_admin"], storeRoles: [] }]);
    user.resolveTenantForHost = async () => {
      await Promise.resolve();
      return { tenantId: TENANT, storeId: null, type: "tenant_site" };
    };
    await expectHttpError(
      loadControl({ host: "site.example.com" }, user),
      404,
      "HOST_ROUTE_MISMATCH",
    );
  });

  test("store_catalog não autoriza /admin", async () => {
    const user = authenticated([{
      tenantId: TENANT,
      storeId: STORE,
      tenantRoles: [],
      storeRoles: ["store_admin"],
    }]);
    user.resolveTenantForHost = async () => {
      await Promise.resolve();
      return { tenantId: TENANT, storeId: STORE, type: "store_catalog" };
    };
    await expectHttpError(
      loadStoreAdmin({ host: "loja.example.com" }, user),
      404,
      "HOST_ROUTE_MISMATCH",
    );
  });
});
