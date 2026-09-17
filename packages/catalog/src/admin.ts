import type { CatalogScope } from "./types.ts";
import type {
  CatalogFontKey,
  CatalogLayout,
  CheckoutMode,
} from "./storefront.ts";

export interface MerchantProductInput {
  name: string;
  slug?: string;
  categoryId?: string | null;
  description?: string;
  sku?: string | null;
  priceCents: number;
  compareAtPriceCents?: number | null;
  costCents?: number | null;
  active?: boolean;
  trackInventory?: boolean;
}

export interface NormalizedMerchantProductInput {
  name: string;
  slug: string;
  categoryId: string | null;
  description: string;
  sku: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  active: boolean;
  trackInventory: boolean;
}

export interface MerchantVariantInput {
  id?: string;
  name: string;
  sku?: string | null;
  attributes?: Record<string, string>;
  priceCents: number;
  compareAtPriceCents?: number | null;
  costCents?: number | null;
  active?: boolean;
  position?: number;
}

export interface NormalizedMerchantVariantInput {
  id?: string;
  name: string;
  sku: string | null;
  attributes: Record<string, string>;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  active: boolean;
  position: number;
}

export interface MerchantCategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  active?: boolean;
  position?: number;
}

export interface NormalizedMerchantCategoryInput {
  name: string;
  slug: string;
  parentId: string | null;
  active: boolean;
  position: number;
}

export interface MerchantCatalogSettingsInput {
  layout?: CatalogLayout;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontKey?: CatalogFontKey;
  showSearch?: boolean;
  showCategories?: boolean;
  showStock?: boolean;
  showPrices?: boolean;
  checkoutMode?: CheckoutMode;
  whatsappPhone?: string | null;
  whatsappMessageTemplate?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  labels?: Record<string, string>;
}

export interface NormalizedMerchantCatalogSettingsInput {
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
  seoTitle: string | null;
  seoDescription: string | null;
  labels: Record<string, string>;
}

export interface MerchantBannerInput {
  id?: string;
  objectKey: string;
  title?: string | null;
  subtitle?: string | null;
  linkUrl?: string | null;
  active?: boolean;
  position?: number;
}

export interface NormalizedMerchantBannerInput {
  id?: string;
  objectKey: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  active: boolean;
  position: number;
}

export interface MerchantAdminProduct {
  id: string;
  categoryId: string | null;
  name: string;
  slug: string;
  sku: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  active: boolean;
  trackInventory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantAdminCategory {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  active: boolean;
  position: number;
}

export interface MerchantAdminBanner {
  id: string;
  objectKey: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  active: boolean;
  position: number;
}

export interface MerchantCatalogAdminSnapshot {
  products: MerchantAdminProduct[];
  categories: MerchantAdminCategory[];
  banners: MerchantAdminBanner[];
  settings: NormalizedMerchantCatalogSettingsInput;
}

export interface CatalogAdminRepository {
  getSnapshot(scope: CatalogScope): Promise<MerchantCatalogAdminSnapshot>;
  createProduct(
    scope: CatalogScope,
    input: NormalizedMerchantProductInput,
  ): Promise<string>;
  updateProduct(
    scope: CatalogScope,
    productId: string,
    input: NormalizedMerchantProductInput,
  ): Promise<void>;
  setProductActive(
    scope: CatalogScope,
    productId: string,
    active: boolean,
  ): Promise<void>;
  replaceProductVariants(
    scope: CatalogScope,
    productId: string,
    variants: NormalizedMerchantVariantInput[],
  ): Promise<void>;
  createCategory(
    scope: CatalogScope,
    input: NormalizedMerchantCategoryInput,
  ): Promise<string>;
  updateCategory(
    scope: CatalogScope,
    categoryId: string,
    input: NormalizedMerchantCategoryInput,
  ): Promise<void>;
  upsertSettings(
    scope: CatalogScope,
    input: NormalizedMerchantCatalogSettingsInput,
  ): Promise<void>;
  upsertBanner(
    scope: CatalogScope,
    input: NormalizedMerchantBannerInput,
  ): Promise<string>;
  deleteBanner(scope: CatalogScope, bannerId: string): Promise<void>;
}
