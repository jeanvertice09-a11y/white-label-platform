import { describe, expect, test } from "bun:test";
import {
  AuthorizationError,
  assertCanManageTenantStores,
  canManageTenantStores,
} from "../../packages/auth/src/index.ts";

describe("fase 05 control merchant RBAC", () => {
  test("tenant_owner e tenant_admin podem administrar lojistas", () => {
    expect(canManageTenantStores({ tenantRoles: ["tenant_owner"] })).toBe(true);
    expect(canManageTenantStores({ tenantRoles: ["tenant_admin"] })).toBe(true);
  });

  test("tenant_support e tenant_finance não ganham mutações", () => {
    expect(canManageTenantStores({ tenantRoles: ["tenant_support"] })).toBe(false);
    expect(canManageTenantStores({ tenantRoles: ["tenant_finance"] })).toBe(false);
    expect(() => {
      assertCanManageTenantStores({ tenantRoles: ["tenant_support"] });
    }).toThrow(AuthorizationError);
    expect(() => {
      assertCanManageTenantStores({ tenantRoles: ["tenant_finance"] });
    }).toThrow(AuthorizationError);
  });
});
