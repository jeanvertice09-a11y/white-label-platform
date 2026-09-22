export type CatalogLayout = "classic" | "modern";
export type CheckoutMode = "whatsapp" | "online" | "both";

export interface CatalogScope {
  tenantId: string;
  storeId: string;
}

export interface Category extends CatalogScope {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  active: boolean;
  position: number;
}

export interface ProductVariant extends CatalogScope {
  id: string;
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

export interface ProductImage extends CatalogScope {
  id: string;
  productId: string;
  variantId: string | null;
  objectKey: string;
  altText: string | null;
  position: number;
}

export interface Product extends CatalogScope {
  id: string;
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
  variants: ProductVariant[];
  images: ProductImage[];
}

export interface CatalogSettings extends CatalogScope {
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

export interface CatalogMerchandising {
  enabled: boolean;
  text: string;
  href: string | null;
  startsAt: string | null;
  endsAt: string | null;
  countdown: boolean;
}

export interface PublicCatalogMerchandising {
  text: string;
  href: string | null;
  endsAt: string | null;
  countdown: boolean;
  serverNow: string;
}

export interface StoreBanner extends CatalogScope {
  id: string;
  title: string | null;
  altText: string | null;
  imageObjectKey: string;
  href: string | null;
  active: boolean;
  position: number;
}

export interface StorefrontStore extends CatalogScope {
  name: string;
  slug: string;
  tenantStatus: "trial" | "active" | "suspended";
  storeStatus: "draft" | "active" | "suspended";
  trialEndsAt: string | null;
}

export interface PublicStoreProfile {
  description: string | null;
  phone: string | null;
  publicEmail: string | null;
  address: string | null;
  instagram: string | null;
}

export interface CatalogQuery extends CatalogScope {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  sort?: "position" | "name" | "price_asc" | "price_desc";
}

export interface CatalogPage {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
}

export interface StorefrontSnapshot {
  store: StorefrontStore;
  settings: CatalogSettings;
  categories: Category[];
  banners: StoreBanner[];
  products: CatalogPage;
  profile?: PublicStoreProfile;
  merchandising?: PublicCatalogMerchandising | null;
}
