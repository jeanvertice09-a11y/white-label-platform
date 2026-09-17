import { describe, expect, test } from "bun:test";
import { isStorefrontAvailable } from "../../packages/catalog/src/storefront.ts";
import type { StorefrontStore } from "../../packages/catalog/src/types.ts";

function store(overrides: Partial<StorefrontStore> = {}): StorefrontStore {
  return {
    tenantId: "t1",
    storeId: "s1",
    name: "Loja",
    slug: "loja",
    tenantStatus: "active",
    storeStatus: "active",
    ...overrides,
  };
}

describe("storefront availability", () => {
  test("trial válido pelo status pode usar catálogo sem pagamento", () => {
    expect(isStorefrontAvailable(store({ tenantStatus: "trial" }))).toBe(true);
  });

  test("loja inativa é bloqueada", () => {
    expect(isStorefrontAvailable(store({ storeStatus: "suspended" }))).toBe(false);
  });

  test("tenant suspenso é bloqueado", () => {
    expect(isStorefrontAvailable(store({ tenantStatus: "suspended" }))).toBe(false);
  });
});
