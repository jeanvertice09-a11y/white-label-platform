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
    trialEndsAt: null,
    ...overrides,
  };
}

describe("storefront availability", () => {
  test("trial legado sem expiração configurada pode usar catálogo", () => {
    expect(isStorefrontAvailable(store({ tenantStatus: "trial" }))).toBe(true);
  });

  test("trial futuro pode usar catálogo sem pagamento confirmado", () => {
    expect(isStorefrontAvailable(
      store({ tenantStatus: "trial", trialEndsAt: "2030-01-01T00:00:00.000Z" }),
      new Date("2026-09-17T00:00:00.000Z"),
    )).toBe(true);
  });

  test("trial expirado é bloqueado", () => {
    expect(isStorefrontAvailable(
      store({ tenantStatus: "trial", trialEndsAt: "2026-09-16T00:00:00.000Z" }),
      new Date("2026-09-17T00:00:00.000Z"),
    )).toBe(false);
  });

  test("loja inativa é bloqueada", () => {
    expect(isStorefrontAvailable(store({ storeStatus: "suspended" }))).toBe(false);
  });

  test("tenant suspenso é bloqueado", () => {
    expect(isStorefrontAvailable(store({ tenantStatus: "suspended" }))).toBe(false);
  });
});
