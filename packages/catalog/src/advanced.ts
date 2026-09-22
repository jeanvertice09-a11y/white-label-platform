import type { CatalogSettings, Product } from "./types.ts";

export type CatalogCardStyle = "default" | "compact";
export type CatalogProductsPerRow = 2 | 3 | 4;

export interface CatalogAdvancedSettings {
  showOutOfStock: boolean;
  searchSuggestions: boolean;
  checkoutAskName: boolean;
  checkoutAskPhone: boolean;
  checkoutAskNotes: boolean;
  minimumOrderCents: number;
  productsPerRow: CatalogProductsPerRow;
  cardStyle: CatalogCardStyle;
}

export const CATALOG_ADVANCED_LABEL_KEYS = [
  "show_out_of_stock",
  "search_suggestions",
  "checkout_ask_name",
  "checkout_ask_phone",
  "checkout_ask_notes",
  "minimum_order_cents",
  "products_per_row",
  "card_style",
] as const;

export const DEFAULT_CATALOG_ADVANCED_SETTINGS: Readonly<CatalogAdvancedSettings> = {
  showOutOfStock: true,
  searchSuggestions: true,
  checkoutAskName: true,
  checkoutAskPhone: true,
  checkoutAskNotes: true,
  minimumOrderCents: 0,
  productsPerRow: 4,
  cardStyle: "default",
};

function booleanLabel(labels: Record<string, string>, key: string, fallback: boolean): boolean {
  const value = labels[key];
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function minimumOrder(labels: Record<string, string>): number {
  const raw = labels["minimum_order_cents"];
  if (!raw || !/^\d+$/.test(raw)) return 0;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000 ? value : 0;
}

function productsPerRow(labels: Record<string, string>): CatalogProductsPerRow {
  const value = Number(labels["products_per_row"]);
  return value === 2 || value === 3 || value === 4 ? value : 4;
}

export function getCatalogAdvancedSettings(
  settings: Pick<CatalogSettings, "labels">,
): CatalogAdvancedSettings {
  const labels = settings.labels;
  return {
    showOutOfStock: booleanLabel(labels, "show_out_of_stock", true),
    searchSuggestions: booleanLabel(labels, "search_suggestions", true),
    checkoutAskName: booleanLabel(labels, "checkout_ask_name", true),
    checkoutAskPhone: booleanLabel(labels, "checkout_ask_phone", true),
    checkoutAskNotes: booleanLabel(labels, "checkout_ask_notes", true),
    minimumOrderCents: minimumOrder(labels),
    productsPerRow: productsPerRow(labels),
    cardStyle: labels["card_style"] === "compact" ? "compact" : "default",
  };
}

export function mergeCatalogAdvancedSettingsLabels(
  labels: Record<string, string>,
  settings: CatalogAdvancedSettings,
): Record<string, string> {
  return {
    ...labels,
    show_out_of_stock: String(settings.showOutOfStock),
    search_suggestions: String(settings.searchSuggestions),
    checkout_ask_name: String(settings.checkoutAskName),
    checkout_ask_phone: String(settings.checkoutAskPhone),
    checkout_ask_notes: String(settings.checkoutAskNotes),
    minimum_order_cents: String(settings.minimumOrderCents),
    products_per_row: String(settings.productsPerRow),
    card_style: settings.cardStyle,
  };
}

export function isProductAvailable(product: Product): boolean {
  if (!product.trackInventory) return true;
  if (product.variants.length === 0) return product.stockQuantity > 0;
  return product.variants.some((variant) => variant.active && variant.stockQuantity > 0);
}
