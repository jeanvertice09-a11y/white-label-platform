import { describe, expect, test } from "bun:test";
import { assertCanAccessMaster, assertCanAccessStoreAdmin, AuthorizationError } from "../../../packages/auth/src/authorize.ts";
import { resolveTenantContext } from "../../../packages/tenant/src/context.ts";
import type { TenantId, UserId } from "../../../packages/tenant/src/branded.ts";

const T = "11111111-1111-4111-8111-111111111111" as TenantId;
const U = "33333333-3333-4333-8333-333333333333" as UserId;

describe("authorization + anti-spoof (bloqueante)", () => {
  test("role sem permissao recebe rejeicao (master)", () => {
    expect(() => {
      assertCanAccessMaster({ platformRoles: ["platform_support"] });
    }).toThrow(AuthorizationError);
  });
  test("store_staff nao acessa /admin", () => {
    expect(() => {
      assertCanAccessStoreAdmin({ storeRoles: ["store_staff"] });
    }).toThrow(AuthorizationError);
  });
  test("tenantId arbitrario do client nao substitui contexto autenticado", () => {
    // O client envia { tenantId: T2 } no body; o servidor ignora e usa
    // apenas activeTenantId derivado de sessao+membership (aqui: T).
    const clientBody = { tenantId: "22222222-2222-4222-8222-222222222222" };
    const ctx = resolveTenantContext({
      userId: U,
      platformRoles: [],
      memberships: [{ tenantId: T, tenantRoles: ["tenant_admin"], storeRoles: [] }],
      activeTenantId: T, // derivado do servidor, NAO do body
      requestId: "r",
    });
    expect(ctx.tenantId).toBe(T);
    expect(ctx.tenantId).not.toBe(clientBody.tenantId);
  });
});
