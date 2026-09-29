import { describe, expect, test } from "bun:test";
import { canAccessStoreAdmin } from "@white-label/auth";

// Inventory usa o mesmo boundary central de /admin, sem roles paralelas.
describe("inventory RBAC", () => {
  for (const role of ["store_owner", "store_admin", "store_manager"] as const) {
    test(`${role} possui autoridade administrativa de estoque`, () => {
      expect(canAccessStoreAdmin({ storeRoles: [role] })).toBe(true);
    });
  }

  test("store_staff não possui autoridade administrativa de estoque", () => {
    expect(canAccessStoreAdmin({ storeRoles: ["store_staff"] })).toBe(false);
  });
});
