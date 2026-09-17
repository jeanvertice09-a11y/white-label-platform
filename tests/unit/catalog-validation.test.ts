import { describe, expect, test } from "bun:test";
import { assertCatalogSettings } from "../../packages/catalog/src/validation.ts";
import type { CatalogSettings } from "../../packages/catalog/src/types.ts";

const settings: CatalogSettings = {
  tenantId: "t1",
  storeId: "s1",
  layout: "classic",
  primaryColor: "#111827",
  accentColor: "#2563eb",
  backgroundColor: "#ffffff",
  fontFamily: "system",
  showSearch: true,
  showCategories: true,
  showPrice: true,
  showStock: false,
  labels: {},
  whatsappPhone: null,
  whatsappMessage: "Olá! Quero finalizar meu pedido:",
  checkoutMode: "whatsapp",
  seoTitle: null,
  seoDescription: null,
};

describe("catalog settings validation", () => {
  test("aceita configuração estruturada válida", () => {
    expect(() => {
      assertCatalogSettings(settings);
    }).not.toThrow();
  });

  test("bloqueia HTML arbitrário em labels", () => {
    expect(() => {
      assertCatalogSettings({ ...settings, labels: { title: "<script>x</script>" } });
    }).toThrow();
  });

  test("bloqueia cor fora do formato permitido", () => {
    expect(() => {
      assertCatalogSettings({ ...settings, primaryColor: "red; background:url(x)" });
    }).toThrow();
  });
});
