import { describe, expect, test } from "bun:test";
import { resolveTenantContext, assertSameTenant, assertSameStore } from "../../../packages/tenant/src/context.ts";
import type { StoreId, TenantId, UserId } from "../../../packages/tenant/src/branded.ts";

// Isolamento simulado em memoria com as MESMAS primitivas de producao
// (resolveTenantContext + asserts). O banco impoe a segunda barreira
// (FK composta + RLS — ver fk-composite.test.ts e rls.test.ts).
const TA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as TenantId;
const TB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as TenantId;
const SA = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa" as StoreId;
const U = "cccccccc-cccc-4ccc-8ccc-cccccccccccc" as UserId;

interface Resource {
  tenantId: TenantId;
  storeId: StoreId;
  data: string;
}

function readResource(ctxTenant: TenantId, res: Resource): string {
  if (ctxTenant !== res.tenantId) throw new Error("CROSS_TENANT_DENIED");
  return res.data;
}

describe("tenant isolation (bloqueante)", () => {
  const resB: Resource = { tenantId: TB, storeId: SA, data: "segredo-B" };
  test("Tenant A nao le recurso do Tenant B", () => {
    const ctx = resolveTenantContext({
      userId: U,
      platformRoles: [],
      memberships: [{ tenantId: TA, tenantRoles: ["tenant_admin"], storeRoles: [] }],
      activeTenantId: TA,
      requestId: "r",
    });
    expect(() => readResource(ctx.tenantId, resB)).toThrow();
    expect(() => {
      assertSameTenant(ctx, TB);
    }).toThrow();
  });
  test("Tenant A nao altera/exclui recurso do Tenant B (mesmo gate)", () => {
    const ctx = resolveTenantContext({
      userId: U,
      platformRoles: [],
      memberships: [{ tenantId: TA, tenantRoles: ["tenant_admin"], storeRoles: [] }],
      activeTenantId: TA,
      requestId: "r",
    });
    const update = (): void => {
      assertSameTenant(ctx, resB.tenantId);
    };
    const remove = (): void => {
      assertSameTenant(ctx, resB.tenantId);
    };
    expect(update).toThrow();
    expect(remove).toThrow();
  });
  test("Store A nao opera Store B sem membership", () => {
    const ctx = resolveTenantContext({
      userId: U,
      platformRoles: [],
      memberships: [{ tenantId: TA, tenantRoles: ["tenant_admin"], storeRoles: ["store_admin"], storeId: SA }],
      activeTenantId: TA,
      activeStoreId: SA,
      requestId: "r",
    });
    const SB = "bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb" as StoreId;
    expect(() => {
      assertSameStore(ctx, SB);
    }).toThrow();
  });
});
