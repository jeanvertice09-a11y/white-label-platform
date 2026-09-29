import type { CatalogScope, CatalogSettings } from "./types.ts";

export function defaultCatalogSettings(scope: CatalogScope): CatalogSettings {
  return {
    ...scope,
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
}
