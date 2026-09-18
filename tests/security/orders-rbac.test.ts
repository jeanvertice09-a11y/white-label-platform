import { describe, expect, test } from "bun:test";
import { canAccessStoreAdmin } from "@white-label/auth";

// Orders usa createMerchantOperationsContext -> loadStoreAdmin, sem RBAC paralelo.
describe("orders RBAC", () => {
  for (const role of ["store_owner", "store_admin", "store_manager"] as const) {
    test(`${role} possui autoridade administrativa de pedidos`, () => {
      expect(canAccessStoreAdmin({ storeRoles: [role] })).toBe(true);
    });
  }

  test("store_staff não possui autoridade administrativa de pedidos", () => {
    expect(canAccessStoreAdmin({ storeRoles: ["store_staff"] })).toBe(false);
  });
});
