import type { CatalogSettings } from "./types.ts";

export interface CatalogBehavior {
  showDescription: boolean;
  showSku: boolean;
  showWhatsapp: boolean;
  showBuyButton: boolean;
  catalogOnly: boolean;
  cartEnabled: boolean;
  quantityEnabled: boolean;
  persistCart: boolean;
  showShare: boolean;
  showRelated: boolean;
}

export type CatalogBehaviorFlag = keyof CatalogBehavior;

const LABEL_BY_FLAG: Record<CatalogBehaviorFlag, string> = {
  showDescription: "show_description",
  showSku: "show_sku",
  showWhatsapp: "show_whatsapp",
  showBuyButton: "show_buy_button",
  catalogOnly: "catalog_only",
  cartEnabled: "cart_enabled",
  quantityEnabled: "quantity_enabled",
  persistCart: "persist_cart",
  showShare: "show_share",
  showRelated: "show_related",
};

export const DEFAULT_CATALOG_BEHAVIOR: Readonly<CatalogBehavior> = Object.freeze({
  showDescription: true,
  showSku: false,
  showWhatsapp: true,
  showBuyButton: true,
  catalogOnly: false,
  cartEnabled: true,
  quantityEnabled: true,
  persistCart: true,
  showShare: true,
  showRelated: true,
});

function readFlag(labels: Partial<Record<string, string>>, key: string, fallback: boolean): boolean {
  const value = labels[key]?.trim().toLowerCase();
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

export function getCatalogBehavior(settings: Pick<CatalogSettings, "labels">): CatalogBehavior {
  const labels = settings.labels;
  return {
    showDescription: readFlag(labels, LABEL_BY_FLAG.showDescription, DEFAULT_CATALOG_BEHAVIOR.showDescription),
    showSku: readFlag(labels, LABEL_BY_FLAG.showSku, DEFAULT_CATALOG_BEHAVIOR.showSku),
    showWhatsapp: readFlag(labels, LABEL_BY_FLAG.showWhatsapp, DEFAULT_CATALOG_BEHAVIOR.showWhatsapp),
    showBuyButton: readFlag(labels, LABEL_BY_FLAG.showBuyButton, DEFAULT_CATALOG_BEHAVIOR.showBuyButton),
    catalogOnly: readFlag(labels, LABEL_BY_FLAG.catalogOnly, DEFAULT_CATALOG_BEHAVIOR.catalogOnly),
    cartEnabled: readFlag(labels, LABEL_BY_FLAG.cartEnabled, DEFAULT_CATALOG_BEHAVIOR.cartEnabled),
    quantityEnabled: readFlag(labels, LABEL_BY_FLAG.quantityEnabled, DEFAULT_CATALOG_BEHAVIOR.quantityEnabled),
    persistCart: readFlag(labels, LABEL_BY_FLAG.persistCart, DEFAULT_CATALOG_BEHAVIOR.persistCart),
    showShare: readFlag(labels, LABEL_BY_FLAG.showShare, DEFAULT_CATALOG_BEHAVIOR.showShare),
    showRelated: readFlag(labels, LABEL_BY_FLAG.showRelated, DEFAULT_CATALOG_BEHAVIOR.showRelated),
  };
}

export function setCatalogBehaviorFlag(
  labels: Record<string, string>,
  flag: CatalogBehaviorFlag,
  enabled: boolean,
): Record<string, string> {
  return { ...labels, [LABEL_BY_FLAG[flag]]: enabled ? "1" : "0" };
}

export function isCatalogCheckoutEnabled(settings: Pick<CatalogSettings, "labels">): boolean {
  const behavior = getCatalogBehavior(settings);
  return behavior.cartEnabled && behavior.showBuyButton && !behavior.catalogOnly;
}
