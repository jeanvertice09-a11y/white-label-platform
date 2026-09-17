import { describe, expect, test } from "bun:test";
import { resolvePurchasableSelection } from "../../packages/catalog/src/pricing.ts";
import type { Product } from "../../packages/catalog/src/types.ts";

const baseProduct: Product = {
  id: "p1",
  tenantId: "t1",
  storeId: "s1",
  name: "Camiseta",
  slug: "camiseta",
  description: null,
  sku: null,
  categoryId: null,
  priceCents: 1299,
  compareAtPriceCents: null,
  costCents: null,
  active: true,
  trackInventory: false,
  stockQuantity: 0,
  position: 0,
  images: [],
  variants: [],
};

describe("catalog pricing", () => {
  test("produto sem variante usa preço base", () => {
    expect(resolvePurchasableSelection(baseProduct).unitPriceCents).toBe(1299);
  });

  test("produto com variante exige seleção", () => {
    const product: Product = {
      ...baseProduct,
      variants: [{
        id: "v1",
        tenantId: "t1",
        storeId: "s1",
        productId: "p1",
        name: "P",
        sku: null,
        attributes: { tamanho: "P" },
        priceCents: 1299,
        compareAtPriceCents: null,
        costCents: null,
        active: true,
        stockQuantity: 0,
        position: 0,
      }],
    };
    expect(() => resolvePurchasableSelection(product)).toThrow("VARIANT_REQUIRED");
  });

  test("usa exatamente o preço da variante selecionada", () => {
    const product: Product = {
      ...baseProduct,
      variants: [
        { id: "p", tenantId: "t1", storeId: "s1", productId: "p1", name: "P", sku: null, attributes: {}, priceCents: 1299, compareAtPriceCents: null, costCents: null, active: true, stockQuantity: 0, position: 0 },
        { id: "g", tenantId: "t1", storeId: "s1", productId: "p1", name: "G", sku: null, attributes: {}, priceCents: 1399, compareAtPriceCents: null, costCents: null, active: true, stockQuantity: 0, position: 1 },
      ],
    };
    expect(resolvePurchasableSelection(product, "p").unitPriceCents).toBe(1299);
    expect(resolvePurchasableSelection(product, "g").unitPriceCents).toBe(1399);
  });

  test("variante de outra loja é rejeitada", () => {
    const product: Product = {
      ...baseProduct,
      variants: [{
        id: "v2",
        tenantId: "t1",
        storeId: "s2",
        productId: "p1",
        name: "P",
        sku: null,
        attributes: {},
        priceCents: 999,
        compareAtPriceCents: null,
        costCents: null,
        active: true,
        stockQuantity: 0,
        position: 0,
      }],
    };
    expect(() => resolvePurchasableSelection(product, "v2")).toThrow();
  });
});
