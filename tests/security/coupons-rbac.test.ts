import { describe, expect, test } from "bun:test";
import { canAccessStoreAdmin } from "@white-label/auth";

describe("phase 15 coupon RBAC", () => {
  for (const role of ["store_owner", "store_admin", "store_manager"] as const) {
    test(`${role} pode administrar cupons pelo boundary central`, () => {
      expect(canAccessStoreAdmin({ storeRoles: [role] })).toBe(true);
    });
  }

  test("store_staff não ganha administração de cupons", () => {
    expect(canAccessStoreAdmin({ storeRoles: ["store_staff"] })).toBe(false);
  });

  test("sem membership de store não há administração", () => {
    expect(canAccessStoreAdmin({ storeRoles: [] })).toBe(false);
  });
});
