import { describe, expect, test } from "bun:test";
import { assertCanManageTenantStores, AuthorizationError } from "@white-label/auth";

describe("fase 07 domain RBAC", () => {
  test("tenant_owner e tenant_admin podem administrar domínios", () => {
    expect(() => { assertCanManageTenantStores({ tenantRoles: ["tenant_owner"] }); }).not.toThrow();
    expect(() => { assertCanManageTenantStores({ tenantRoles: ["tenant_admin"] }); }).not.toThrow();
  });

  test("support/finance não recebem mutações de domínio", () => {
    expect(() => { assertCanManageTenantStores({ tenantRoles: ["tenant_support"] }); }).toThrow(AuthorizationError);
    expect(() => { assertCanManageTenantStores({ tenantRoles: ["tenant_finance"] }); }).toThrow(AuthorizationError);
  });
});
