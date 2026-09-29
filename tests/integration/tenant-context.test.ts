import { describe, expect, test } from "bun:test";
import { resolveTenantContext, assertSameTenant } from "../../packages/tenant/src/context.ts";
import type { TenantId, UserId } from "../../packages/tenant/src/branded.ts";

const T1 = "11111111-1111-4111-8111-111111111111" as TenantId;
const T2 = "22222222-2222-4222-8222-222222222222" as TenantId;
const U = "33333333-3333-4333-8333-333333333333" as UserId;

describe("tenant context", () => {
  test("resolve exige membership; tenant sem vinculo e rejeitado", () => {
    expect(() =>
      resolveTenantContext({
        userId: U,
        platformRoles: [],
        memberships: [{ tenantId: T1, tenantRoles: ["tenant_admin"], storeRoles: [] }],
        activeTenantId: T2,
        requestId: "r1",
      }),
    ).toThrow();
  });
  test("assertSameTenant bloqueia cross-tenant", () => {
    const ctx = resolveTenantContext({
      userId: U,
      platformRoles: [],
      memberships: [{ tenantId: T1, tenantRoles: ["tenant_admin"], storeRoles: [] }],
      activeTenantId: T1,
      requestId: "r1",
    });
    expect(() => {
      assertSameTenant(ctx, T2);
    }).toThrow();
  });
});
