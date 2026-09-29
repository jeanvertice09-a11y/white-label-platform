import { describe, expect, test } from "bun:test";
import {
  assertCanManageWhiteLabels,
  canManageWhiteLabels,
} from "../../packages/auth/src/authorize.ts";

describe("fase 13 platform_billing RBAC", () => {
  test("platform_owner e platform_admin podem administrar billing Kataluu", () => {
    expect(canManageWhiteLabels({ platformRoles: ["platform_owner"] })).toBe(true);
    expect(canManageWhiteLabels({ platformRoles: ["platform_admin"] })).toBe(true);
  });

  test("platform_support e platform_finance não podem mutar assinatura/cobrança", () => {
    expect(canManageWhiteLabels({ platformRoles: ["platform_support"] })).toBe(false);
    expect(canManageWhiteLabels({ platformRoles: ["platform_finance"] })).toBe(false);
    expect(() => { assertCanManageWhiteLabels({ platformRoles: ["platform_support"] }); }).toThrow();
    expect(() => { assertCanManageWhiteLabels({ platformRoles: ["platform_finance"] }); }).toThrow();
  });

  test("papéis tenant/store não elevam autoridade no /master", () => {
    expect(canManageWhiteLabels({ tenantRoles: ["tenant_owner"] })).toBe(false);
    expect(canManageWhiteLabels({ tenantRoles: ["tenant_admin"] })).toBe(false);
    expect(canManageWhiteLabels({ storeRoles: ["store_owner"] })).toBe(false);
    expect(canManageWhiteLabels({ storeRoles: ["store_admin"] })).toBe(false);
  });
});
