import type { CatalogSqlExecutor } from "./postgres.ts";
import type { CatalogScope } from "./types.ts";
import type {
  MerchantAdminBanner,
  MerchantAdminCategory,
  MerchantAdminProduct,
  MerchantCatalogAdminSnapshot,
} from "./admin.ts";
import { normalizeMerchantCatalogSettingsInput } from "./admin-validation.ts";

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Campo inválido: ${field}`);
  }
  return value;
}

function nullableText(value: unknown, field: string): string | null {
  if (value == null) return null;
  return text(value, field);
}

function numberValue(value: unknown, field: string): number {
  const parsed =
    typeof value === "number" ? value :
    typeof value === "bigint" ? Number(value) :
    typeof value === "string" ? Number(value) :
    Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`Campo inválido: ${field}`);
  return parsed;
}

function dateText(value: unknown, field: string): string {
  if (value instanceof Date) return value.toISOString();
  return text(value, field);
}

function boolValue(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Campo inválido: ${field}`);
  return value;
}

function mapProduct(row: Record<string, unknown>): MerchantAdminProduct {
  return {
    id: text(row["id"], "id"),
    categoryId: nullableText(row["category_id"], "category_id"),
    name: text(row["name"], "name"),
    slug: text(row["slug"], "slug"),
    sku: nullableText(row["sku"], "sku"),
    priceCents: numberValue(row["price_cents"], "price_cents"),
    compareAtPriceCents:
      row["compare_at_price_cents"] == null
        ? null
        : numberValue(row["compare_at_price_cents"], "compare_at_price_cents"),
    costCents:
      row["cost_cents"] == null
        ? null
        : numberValue(row["cost_cents"], "cost_cents"),
    active: boolValue(row["active"], "active"),
    trackInventory: boolValue(row["track_inventory"], "track_inventory"),
    createdAt: dateText(row["created_at"], "created_at"),
    updatedAt: dateText(row["updated_at"], "updated_at"),
  };
}

function mapCategory(row: Record<string, unknown>): MerchantAdminCategory {
  return {
    id: text(row["id"], "id"),
    parentId: nullableText(row["parent_id"], "parent_id"),
    name: text(row["name"], "name"),
    slug: text(row["slug"], "slug"),
    active: boolValue(row["active"], "active"),
    position: numberValue(row["position"], "position"),
  };
}

function mapBanner(row: Record<string, unknown>): MerchantAdminBanner {
  return {
    id: text(row["id"], "id"),
    objectKey: text(row["object_key"], "object_key"),
    title: nullableText(row["title"], "title"),
    subtitle: nullableText(row["subtitle"], "subtitle"),
    linkUrl: nullableText(row["link_url"], "link_url"),
    active: boolValue(row["active"], "active"),
    position: numberValue(row["position"], "position"),
  };
}

function settingsInput(row: Record<string, unknown> | undefined) {
  if (!row) return {};
  const labels =
    typeof row["labels"] === "object" &&
    row["labels"] !== null &&
    !Array.isArray(row["labels"])
      ? (row["labels"] as Record<string, string>)
      : {};

  return {
    layout: text(row["layout"], "layout") as "classic" | "modern",
    primaryColor: text(row["primary_color"], "primary_color"),
    accentColor: text(row["accent_color"], "accent_color"),
    backgroundColor: text(row["background_color"], "background_color"),
    fontKey: text(row["font_key"], "font_key") as
      | "system" | "inter" | "manrope" | "poppins" | "montserrat" | "playfair",
    showSearch: boolValue(row["show_search"], "show_search"),
    showCategories: boolValue(row["show_categories"], "show_categories"),
    showStock: boolValue(row["show_stock"], "show_stock"),
    showPrices: boolValue(row["show_prices"], "show_prices"),
    checkoutMode: text(row["checkout_mode"], "checkout_mode") as
      | "whatsapp" | "online" | "both",
    whatsappPhone: nullableText(row["whatsapp_phone"], "whatsapp_phone"),
    whatsappMessageTemplate: text(
      row["whatsapp_message_template"],
      "whatsapp_message_template",
    ),
    seoTitle: nullableText(row["seo_title"], "seo_title"),
    seoDescription: nullableText(row["seo_description"], "seo_description"),
    labels,
  };
}

export async function loadMerchantCatalogAdminSnapshot(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
): Promise<MerchantCatalogAdminSnapshot> {
  const [products, categories, banners, settings] = await Promise.all([
    loadProducts(sql, scope),
    loadCategories(sql, scope),
    loadBanners(sql, scope),
    loadSettings(sql, scope),
  ]);
  return { products, categories, banners, settings };
}

async function loadProducts(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
): Promise<MerchantAdminProduct[]> {
  const rows = await sql.query(
    `select id, category_id, name, slug, sku, price_cents,
            compare_at_price_cents, cost_cents, active, track_inventory,
            created_at, updated_at
       from public.products
      where tenant_id = $1 and store_id = $2
      order by created_at desc, id desc`,
    [scope.tenantId, scope.storeId],
  );
  return rows.map(mapProduct);
}

async function loadCategories(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
): Promise<MerchantAdminCategory[]> {
  const rows = await sql.query(
    `select id, parent_id, name, slug, active, position
       from public.categories
      where tenant_id = $1 and store_id = $2
      order by position asc, lower(name) asc, id asc`,
    [scope.tenantId, scope.storeId],
  );
  return rows.map(mapCategory);
}

async function loadBanners(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
): Promise<MerchantAdminBanner[]> {
  const rows = await sql.query(
    `select id, object_key, title, subtitle, link_url, active, position
       from public.catalog_banners
      where tenant_id = $1 and store_id = $2
      order by position asc, id asc`,
    [scope.tenantId, scope.storeId],
  );
  return rows.map(mapBanner);
}

async function loadSettings(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
): Promise<MerchantCatalogAdminSnapshot["settings"]> {
  const rows = await sql.query(
    `select layout, primary_color, accent_color, background_color, font_key,
            show_search, show_categories, show_stock, show_prices,
            checkout_mode, whatsapp_phone, whatsapp_message_template,
            seo_title, seo_description, labels
       from public.catalog_settings
      where tenant_id = $1 and store_id = $2
      limit 1`,
    [scope.tenantId, scope.storeId],
  );
  return normalizeMerchantCatalogSettingsInput(settingsInput(rows[0]));
}
