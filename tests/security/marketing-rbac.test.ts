import { describe, expect, test } from "bun:test";
import { canAccessStoreAdmin } from "../../packages/auth/src/index.ts";

describe("phase 14 marketing RBAC", () => {
  test("somente papéis administrativos já autorizados no /admin passam", () => {
    expect(canAccessStoreAdmin({ storeRoles: ["store_owner"] })).toBe(true);
    expect(canAccessStoreAdmin({ storeRoles: ["store_admin"] })).toBe(true);
    expect(canAccessStoreAdmin({ storeRoles: ["store_manager"] })).toBe(true);
    expect(canAccessStoreAdmin({ storeRoles: ["store_staff"] })).toBe(false);
  });

  test("sem membership de store não há acesso", () => {
    expect(canAccessStoreAdmin({ storeRoles: [] })).toBe(false);
  });
});
