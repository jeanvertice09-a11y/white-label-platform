import type {
  CatalogSettings,
  Category,
  Product,
  ProductImage,
  ProductVariant,
  StoreBanner,
  StorefrontStore,
} from "./types.ts";

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error("Coluna inválida: " + key);
  return value;
}

function optionalText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Coluna inválida: " + key);
  return value;
}

function bool(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw new Error("Coluna inválida: " + key);
  return value;
}

function num(row: Record<string, unknown>, key: string): number {
  const parsed = Number(row[key]);
  if (!Number.isFinite(parsed)) throw new Error("Coluna inválida: " + key);
  return parsed;
}

function optionalNum(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  return num(row, key);
}

function jsonArray(row: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = row[key];
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (typeof value === "string") {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
  }
  return [];
}

function jsonObject(row: Record<string, unknown>, key: string): Record<string, string> {
  const value = row[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  if (typeof value === "string") {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  }
  return {};
}

export function mapVariant(row: Record<string, unknown>): ProductVariant {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    productId: text(row, "product_id"),
    name: text(row, "name"),
    sku: optionalText(row, "sku"),
    attributes: jsonObject(row, "attributes"),
    priceCents: num(row, "price_cents"),
    compareAtPriceCents: optionalNum(row, "compare_at_price_cents"),
    costCents: optionalNum(row, "cost_cents"),
    active: bool(row, "active"),
    stockQuantity: num(row, "stock_quantity"),
    position: num(row, "position"),
  };
}

export function mapImage(row: Record<string, unknown>): ProductImage {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    productId: text(row, "product_id"),
    variantId: optionalText(row, "variant_id"),
    objectKey: text(row, "object_key"),
    altText: optionalText(row, "alt_text"),
    position: num(row, "position"),
  };
}

export function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    name: text(row, "name"),
    slug: text(row, "slug"),
    description: optionalText(row, "description"),
    sku: optionalText(row, "sku"),
    categoryId: optionalText(row, "category_id"),
    priceCents: num(row, "price_cents"),
    compareAtPriceCents: optionalNum(row, "compare_at_price_cents"),
    costCents: optionalNum(row, "cost_cents"),
    active: bool(row, "active"),
    trackInventory: bool(row, "track_inventory"),
    stockQuantity: num(row, "stock_quantity"),
    position: num(row, "position"),
    variants: jsonArray(row, "variants").map((item) => mapVariant(item)),
    images: jsonArray(row, "images").map((item) => mapImage(item)),
  };
}

export function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    name: text(row, "name"),
    slug: text(row, "slug"),
    description: optionalText(row, "description"),
    parentId: optionalText(row, "parent_id"),
    active: bool(row, "active"),
    position: num(row, "position"),
  };
}

export function mapBanner(row: Record<string, unknown>): StoreBanner {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    title: optionalText(row, "title"),
    altText: optionalText(row, "alt_text"),
    imageObjectKey: text(row, "image_object_key"),
    href: optionalText(row, "href"),
    active: bool(row, "active"),
    position: num(row, "position"),
  };
}

export function mapStore(row: Record<string, unknown>): StorefrontStore {
  return {
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    name: text(row, "name"),
    slug: text(row, "slug"),
    tenantStatus: text(row, "tenant_status") as StorefrontStore["tenantStatus"],
    storeStatus: text(row, "store_status") as StorefrontStore["storeStatus"],
    trialEndsAt: optionalText(row, "trial_ends_at"),
  };
}

export function mapSettings(row: Record<string, unknown>): CatalogSettings {
  return {
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    layout: text(row, "layout") as CatalogSettings["layout"],
    primaryColor: text(row, "primary_color"),
    accentColor: text(row, "accent_color"),
    backgroundColor: text(row, "background_color"),
    fontFamily: text(row, "font_family") as CatalogSettings["fontFamily"],
    showSearch: bool(row, "show_search"),
    showCategories: bool(row, "show_categories"),
    showPrice: bool(row, "show_price"),
    showStock: bool(row, "show_stock"),
    labels: jsonObject(row, "labels"),
    whatsappPhone: optionalText(row, "whatsapp_phone"),
    whatsappMessage: text(row, "whatsapp_message"),
    checkoutMode: text(row, "checkout_mode") as CatalogSettings["checkoutMode"],
    seoTitle: optionalText(row, "seo_title"),
    seoDescription: optionalText(row, "seo_description"),
  };
}
