import { describe, expect, test } from "bun:test";
import {
  defaultCatalogSettings,
  getCatalogAdvancedSettings,
  isProductAvailable,
  mergeCatalogAdvancedSettingsLabels,
} from "../../packages/catalog/src/index.ts";
import type { Product } from "../../packages/catalog/src/index.ts";

const scope = { tenantId: "tenant-a", storeId: "store-a" };

function product(stockQuantity: number, variantStocks: number[] = []): Product {
  return {
    ...scope, id: "product-a", name: "Produto", slug: "produto", description: null, sku: "SKU-A", categoryId: null,
    priceCents: 1000, compareAtPriceCents: null, costCents: null, active: true, trackInventory: true, stockQuantity, position: 0,
    images: [], variants: variantStocks.map((stock, index) => ({ ...scope, id: `variant-${String(index)}`, productId: "product-a", name: `V${String(index)}`, sku: null, attributes: {}, priceCents: 1000, compareAtPriceCents: null, costCents: null, active: true, stockQuantity: stock, position: index })),
  };
}

describe("catalog advanced settings", () => {
  test("defaults preservam comportamento das lojas existentes", () => {
    const advanced = getCatalogAdvancedSettings(defaultCatalogSettings(scope));
    expect(advanced).toEqual({ showOutOfStock: true, searchSuggestions: true, checkoutAskName: true, checkoutAskPhone: true, checkoutAskNotes: true, minimumOrderCents: 0, productsPerRow: 4, cardStyle: "default" });
  });

  test("labels persistem somente valores normalizados", () => {
    const settings = defaultCatalogSettings(scope);
    settings.labels = mergeCatalogAdvancedSettingsLabels(settings.labels, { showOutOfStock: false, searchSuggestions: false, checkoutAskName: true, checkoutAskPhone: false, checkoutAskNotes: true, minimumOrderCents: 4990, productsPerRow: 3, cardStyle: "compact" });
    expect(getCatalogAdvancedSettings(settings)).toEqual({ showOutOfStock: false, searchSuggestions: false, checkoutAskName: true, checkoutAskPhone: false, checkoutAskNotes: true, minimumOrderCents: 4990, productsPerRow: 3, cardStyle: "compact" });
  });

  test("valores adulterados em labels falham para defaults seguros", () => {
    const settings = defaultCatalogSettings(scope);
    settings.labels = { minimum_order_cents: "-1", products_per_row: "9", card_style: "script", checkout_ask_phone: "talvez" };
    const advanced = getCatalogAdvancedSettings(settings);
    expect(advanced.minimumOrderCents).toBe(0);
    expect(advanced.productsPerRow).toBe(4);
    expect(advanced.cardStyle).toBe("default");
    expect(advanced.checkoutAskPhone).toBe(true);
  });

  test("disponibilidade respeita estoque base e de variante", () => {
    expect(isProductAvailable(product(0))).toBe(false);
    expect(isProductAvailable(product(2))).toBe(true);
    expect(isProductAvailable(product(0, [0, 3]))).toBe(true);
    expect(isProductAvailable(product(0, [0, 0]))).toBe(false);
  });
});
