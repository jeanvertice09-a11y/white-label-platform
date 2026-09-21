import { describe, expect, test } from "bun:test";
import {
  defaultCatalogSettings,
  getCatalogBehavior,
  isCatalogCheckoutEnabled,
  setCatalogBehaviorFlag,
} from "../../packages/catalog/src/index.ts";

const scope = { tenantId: "tenant-a", storeId: "store-a" };

describe("catalog behavior", () => {
  test("preserva comportamento compatível para configurações antigas", () => {
    const settings = defaultCatalogSettings(scope);
    const behavior = getCatalogBehavior(settings);
    expect(behavior.showDescription).toBe(true);
    expect(behavior.showSku).toBe(false);
    expect(behavior.cartEnabled).toBe(true);
    expect(behavior.showBuyButton).toBe(true);
    expect(behavior.quantityEnabled).toBe(true);
    expect(behavior.persistCart).toBe(true);
    expect(behavior.showShare).toBe(true);
    expect(behavior.showRelated).toBe(true);
    expect(isCatalogCheckoutEnabled(settings)).toBe(true);
  });

  test("modo vitrine desativa checkout sem apagar as demais preferências", () => {
    const settings = defaultCatalogSettings(scope);
    settings.labels = setCatalogBehaviorFlag(settings.labels, "catalogOnly", true);
    settings.labels = setCatalogBehaviorFlag(settings.labels, "showSku", true);
    expect(getCatalogBehavior(settings).catalogOnly).toBe(true);
    expect(getCatalogBehavior(settings).showSku).toBe(true);
    expect(isCatalogCheckoutEnabled(settings)).toBe(false);
  });

  test("flags persistidas aceitam somente os valores booleanos conhecidos", () => {
    const settings = defaultCatalogSettings(scope);
    settings.labels = { show_sku: "true", cart_enabled: "false", show_share: "talvez" };
    const behavior = getCatalogBehavior(settings);
    expect(behavior.showSku).toBe(true);
    expect(behavior.cartEnabled).toBe(false);
    expect(behavior.showShare).toBe(true);
  });
});
