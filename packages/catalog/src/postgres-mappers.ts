import type { Category, Product } from "./types.ts";
import type {
  CatalogBanner,
  CatalogFontKey,
  CatalogLayout,
  CatalogSettings,
  CheckoutMode,
  ProductImage,
} from "./storefront.ts";
import type { ProductVariant } from "./pricing.ts";

function str(value: unknown, column: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`coluna inválida: ${column}`);
  }
  return value;
}

function nullableStr(value: unknown, column: string): string | null {
  if (value == null) return null;
  return str(value, column);
}

export function intValue(value: unknown, column: string): number {
  const parsed =
    typeof value === "bigint"
      ? Number(value)
      : typeof value === "string"
        ? Number(value)
        : typeof value === "number"
          ? value
          : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`coluna inválida: ${column}`);
  }
  return parsed;
}

function instant(value: unknown, column: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error(`coluna inválida: ${column}`);
}

function bool(value: unknown, column: string): boolean {
  if (typeof value !== "boolean") throw new Error(`coluna inválida: ${column}`);
  return value;
}

function record(value: unknown, column: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`coluna inválida: ${column}`);
  }
  return value as Record<string, unknown>;
}

function stringMap(value: unknown, column: string): Record<string, string> {
  const raw = record(value, column);
  return Object.fromEntries(
    Object.entries(raw).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    categoryId: nullableStr(row["category_id"], "category_id"),
    slug: str(row["slug"], "slug"),
    name: str(row["name"], "name"),
    priceCents: intValue(row["price_cents"], "price_cents"),
    compareAtPriceCents:
      row["compare_at_price_cents"] == null
        ? null
        : intValue(row["compare_at_price_cents"], "compare_at_price_cents"),
    sku: nullableStr(row["sku"], "sku"),
    description: typeof row["description"] === "string" ? row["description"] : "",
    trackInventory:
      typeof row["track_inventory"] === "boolean" ? row["track_inventory"] : false,
    primaryImageObjectKey: nullableStr(
      row["primary_image_object_key"],
      "primary_image_object_key",
    ),
    active: bool(row["active"], "active"),
    createdAt: instant(row["created_at"], "created_at"),
  };
}

export function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    slug: str(row["slug"], "slug"),
    name: str(row["name"], "name"),
    createdAt: instant(row["created_at"], "created_at"),
  };
}

export function mapVariant(row: Record<string, unknown>): ProductVariant {
  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    productId: str(row["product_id"], "product_id"),
    name: str(row["name"], "name"),
    sku: nullableStr(row["sku"], "sku"),
    priceCents: intValue(row["price_cents"], "price_cents"),
    active: bool(row["active"], "active"),
    attributes: stringMap(row["attributes"] ?? {}, "attributes"),
  };
}

export function mapImage(row: Record<string, unknown>): ProductImage {
  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    productId: str(row["product_id"], "product_id"),
    objectKey: str(row["object_key"], "object_key"),
    altText: nullableStr(row["alt_text"], "alt_text"),
    position: intValue(row["position"], "position"),
  };
}

export function mapBanner(row: Record<string, unknown>): CatalogBanner {
  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    objectKey: str(row["object_key"], "object_key"),
    title: nullableStr(row["title"], "title"),
    subtitle: nullableStr(row["subtitle"], "subtitle"),
    linkUrl: nullableStr(row["link_url"], "link_url"),
    active: bool(row["active"], "active"),
    position: intValue(row["position"], "position"),
  };
}

export function mapSettings(row: Record<string, unknown>): CatalogSettings {
  return {
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    layout: str(row["layout"], "layout") as CatalogLayout,
    primaryColor: str(row["primary_color"], "primary_color"),
    accentColor: str(row["accent_color"], "accent_color"),
    backgroundColor: str(row["background_color"], "background_color"),
    fontKey: str(row["font_key"], "font_key") as CatalogFontKey,
    showSearch: bool(row["show_search"], "show_search"),
    showCategories: bool(row["show_categories"], "show_categories"),
    showStock: bool(row["show_stock"], "show_stock"),
    showPrices: bool(row["show_prices"], "show_prices"),
    checkoutMode: str(row["checkout_mode"], "checkout_mode") as CheckoutMode,
    whatsappPhone: nullableStr(row["whatsapp_phone"], "whatsapp_phone"),
    whatsappMessageTemplate: str(
      row["whatsapp_message_template"],
      "whatsapp_message_template",
    ),
    currency: "BRL",
    seoTitle: nullableStr(row["seo_title"], "seo_title"),
    seoDescription: nullableStr(row["seo_description"], "seo_description"),
    labels: stringMap(row["labels"] ?? {}, "labels"),
  };
}
