import type { CatalogLayout, CheckoutMode } from "./types.ts";

export interface ProductMutationInput {
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  categoryId: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  active: boolean;
  trackInventory: boolean;
  stockQuantity: number;
  position: number;
}

export interface VariantMutationInput {
  productId: string;
  name: string;
  sku: string | null;
  attributes: Record<string, string>;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  active: boolean;
  stockQuantity: number;
  position: number;
}

export interface CategoryMutationInput {
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  active: boolean;
  position: number;
}

export interface BannerMutationInput {
  title: string | null;
  altText: string | null;
  imageObjectKey: string;
  href: string | null;
  active: boolean;
  position: number;
}

export interface CatalogSettingsMutationInput {
  layout: CatalogLayout;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontFamily: "system" | "inter" | "serif" | "sans";
  showSearch: boolean;
  showCategories: boolean;
  showPrice: boolean;
  showStock: boolean;
  labels: Record<string, string>;
  whatsappPhone: string | null;
  whatsappMessage: string;
  checkoutMode: CheckoutMode;
  seoTitle: string | null;
  seoDescription: string | null;
}
