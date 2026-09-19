import { describe, expect, test } from "bun:test";
import {
  addCartItem,
  cartTotalCents,
  createCart,
  isStorefrontAvailable,
} from "../../packages/catalog/src/index.ts";
import type { Product, StorefrontStore } from "../../packages/catalog/src/index.ts";

const SCOPE = {
  tenantId: "a1730000-0000-4000-8000-000000000001",
  storeId: "a1740000-0000-4000-8000-000000000001",
};

function variantProduct(): Product {
  return {
    ...SCOPE,
    id: "a1750000-0000-4000-8000-000000000001",
    name: "Produto com variantes",
    slug: "produto-variantes",
    description: null,
    sku: null,
    categoryId: null,
    priceCents: 999,
    compareAtPriceCents: null,
    costCents: null,
    active: true,
    trackInventory: true,
    stockQuantity: 0,
    position: 0,
    images: [],
    variants: [
      { ...SCOPE, id: "a1760000-0000-4000-8000-000000000001", productId: "a1750000-0000-4000-8000-000000000001", name: "Azul", sku: null, attributes: { cor: "Azul" }, priceCents: 1299, compareAtPriceCents: 1599, costCents: null, active: true, stockQuantity: 3, position: 0 },
      { ...SCOPE, id: "a1760000-0000-4000-8000-000000000002", productId: "a1750000-0000-4000-8000-000000000001", name: "Verde", sku: null, attributes: { cor: "Verde" }, priceCents: 1499, compareAtPriceCents: null, costCents: null, active: true, stockQuantity: 2, position: 1 },
    ],
  };
}

function storefront(status: StorefrontStore["tenantStatus"], trialEndsAt: string | null): StorefrontStore {
  return { ...SCOPE, name: "Loja", slug: "loja", tenantStatus: status, storeStatus: "active", trialEndsAt };
}

describe("fase 17 storefront commerce unit", () => {
  test("carrinho usa preço exato da variante selecionada e quantidade escolhida", () => {
    const product = variantProduct();
    const cart = addCartItem(createCart(SCOPE), product, product.variants[1]?.id ?? null, 2);
    expect(cart.items[0]?.unitPriceCents).toBe(1499);
    expect(cart.items[0]?.variantName).toBe("Verde");
    expect(cart.items[0]?.quantity).toBe(2);
    expect(cartTotalCents(cart)).toBe(2998);
  });

  test("trial futuro autoriza storefront e trial expirado bloqueia", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    expect(isStorefrontAvailable(storefront("trial", "2026-09-19T12:00:00.000Z"), now)).toBe(true);
    expect(isStorefrontAvailable(storefront("trial", "2026-09-17T12:00:00.000Z"), now)).toBe(false);
    expect(isStorefrontAvailable(storefront("suspended", null), now)).toBe(false);
  });
});
