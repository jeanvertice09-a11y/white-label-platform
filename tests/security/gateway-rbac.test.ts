import { describe, expect, test } from "bun:test";
import {
  assertCanManageTenantGateways,
  canManageTenantGateways,
} from "../../packages/auth/src/authorize.ts";

describe("fase 09 gateway RBAC", () => {
  test("tenant_owner e tenant_admin podem administrar gateways", () => {
    expect(canManageTenantGateways({ tenantRoles: ["tenant_owner"] })).toBe(true);
    expect(canManageTenantGateways({ tenantRoles: ["tenant_admin"] })).toBe(true);
  });

  test("tenant_support e tenant_finance não recebem mutações de gateway", () => {
    expect(canManageTenantGateways({ tenantRoles: ["tenant_support"] })).toBe(false);
    expect(canManageTenantGateways({ tenantRoles: ["tenant_finance"] })).toBe(false);
    expect(() => {
      assertCanManageTenantGateways({ tenantRoles: ["tenant_support"] });
    }).toThrow();
  });

  test("papéis de store não elevam autoridade no control", () => {
    expect(canManageTenantGateways({ storeRoles: ["store_owner"] })).toBe(false);
    expect(canManageTenantGateways({ storeRoles: ["store_staff"] })).toBe(false);
  });
});
