import { describe, expect, test } from "bun:test";
import {
  assertCatalogSettings,
  assertVariantInput,
} from "../../packages/catalog/src/validation.ts";
import type { VariantMutationInput } from "../../packages/catalog/src/admin-types.ts";
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

const variant: VariantMutationInput = {
  productId: "p1",
  name: "Azul P",
  sku: "AZ-P",
  attributes: { cor: "Azul", tamanho: "P" },
  priceCents: 1299,
  compareAtPriceCents: 1499,
  costCents: 700,
  active: true,
  stockQuantity: 5,
  position: 0,
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

describe("variant validation", () => {
  test("aceita múltiplos atributos estruturados", () => {
    expect(() => { assertVariantInput(variant); }).not.toThrow();
  });

  test("rejeita chave de atributo vazia", () => {
    expect(() => {
      assertVariantInput({ ...variant, attributes: { "": "Azul" } });
    }).toThrow();
  });

  test("rejeita estoque negativo", () => {
    expect(() => {
      assertVariantInput({ ...variant, stockQuantity: -1 });
    }).toThrow();
  });
});
