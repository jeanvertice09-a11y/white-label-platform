import type { Product, PublicCatalogSnapshot } from "./types.ts";
import type { ProductVariant } from "./pricing.ts";

export type CatalogLayout = "classic" | "modern";
export type CheckoutMode = "whatsapp" | "online" | "both";
export type CatalogFontKey =
  | "system"
  | "inter"
  | "manrope"
  | "poppins"
  | "montserrat"
  | "playfair";

export interface CatalogSettings {
  tenantId: string;
  storeId: string;
  layout: CatalogLayout;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontKey: CatalogFontKey;
  showSearch: boolean;
  showCategories: boolean;
  showStock: boolean;
  showPrices: boolean;
  checkoutMode: CheckoutMode;
  whatsappPhone: string | null;
  whatsappMessageTemplate: string;
  currency: "BRL";
  seoTitle: string | null;
  seoDescription: string | null;
  labels: Record<string, string>;
}

export interface CatalogBanner {
  id: string;
  tenantId: string;
  storeId: string;
  objectKey: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  active: boolean;
  position: number;
}

export interface ProductImage {
  id: string;
  tenantId: string;
  storeId: string;
  productId: string;
  objectKey: string;
  altText: string | null;
  position: number;
}

export interface PublicStorefrontSnapshot extends PublicCatalogSnapshot {
  settings: CatalogSettings;
  banners: CatalogBanner[];
}

export interface CatalogProductDetail {
  product: Product;
  variants: ProductVariant[];
  images: ProductImage[];
}

export const DEFAULT_CATALOG_SETTINGS: Omit<CatalogSettings, "tenantId" | "storeId"> = {
  layout: "classic",
  primaryColor: "#111111",
  accentColor: "#111111",
  backgroundColor: "#ffffff",
  fontKey: "system",
  showSearch: true,
  showCategories: true,
  showStock: false,
  showPrices: true,
  checkoutMode: "whatsapp",
  whatsappPhone: null,
  whatsappMessageTemplate: "Olá! Gostaria de fazer este pedido:",
  currency: "BRL",
  seoTitle: null,
  seoDescription: null,
  labels: {},
};

export function defaultCatalogSettings(tenantId: string, storeId: string): CatalogSettings {
  return {
    tenantId,
    storeId,
    ...DEFAULT_CATALOG_SETTINGS,
  };
}

export function isWhatsappCheckoutEnabled(settings: CatalogSettings): boolean {
  return settings.checkoutMode === "whatsapp" || settings.checkoutMode === "both";
}

export function isOnlineCheckoutEnabled(settings: CatalogSettings): boolean {
  return settings.checkoutMode === "online" || settings.checkoutMode === "both";
}
