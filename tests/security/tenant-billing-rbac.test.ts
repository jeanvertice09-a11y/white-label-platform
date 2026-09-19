import { describe, expect, test } from "bun:test";
import {
  canManageTenantGateways,
  canManageTenantStores,
} from "../../packages/auth/src/authorize.ts";

describe("phase 16 tenant_billing RBAC", () => {
  test("tenant_owner e tenant_admin mantêm boundary administrativo financeiro", () => {
    for (const role of ["tenant_owner", "tenant_admin"] as const) {
      expect(canManageTenantStores({ tenantRoles: [role] })).toBe(true);
      expect(canManageTenantGateways({ tenantRoles: [role] })).toBe(true);
    }
  });

  test("tenant_finance e tenant_support não ganham mutação sem permissão central definida", () => {
    for (const role of ["tenant_finance", "tenant_support"] as const) {
      expect(canManageTenantStores({ tenantRoles: [role] })).toBe(false);
      expect(canManageTenantGateways({ tenantRoles: [role] })).toBe(false);
    }
  });
});
