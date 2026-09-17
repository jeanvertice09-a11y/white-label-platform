import type { CatalogListResult, CatalogRepository } from "./repository.ts";
import type {
  CatalogScope,
  Category,
  NormalizedCatalogListInput,
  Product,
} from "./types.ts";
import type {
  CatalogBanner,
  CatalogFontKey,
  CatalogLayout,
  CatalogSettings,
  CheckoutMode,
  ProductImage,
} from "./storefront.ts";
import { defaultCatalogSettings } from "./storefront.ts";
import type { ProductVariant } from "./pricing.ts";

export interface CatalogSqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

function str(value: unknown, column: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`coluna inválida: ${column}`);
  }
  return value;
}

function nullableStr(value: unknown, column: string): string | null {
  if (value === null || value === undefined) return null;
  return str(value, column);
}

function int(value: unknown, column: string): number {
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

function object(value: unknown, column: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`coluna inválida: ${column}`);
  }
  return value as Record<string, unknown>;
}

function stringMap(value: unknown, column: string): Record<string, string> {
  const raw = object(value, column);
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === "string") out[key] = val;
  }
  return out;
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    categoryId: nullableStr(row["category_id"], "category_id"),
    slug: str(row["slug"], "slug"),
    name: str(row["name"], "name"),
    priceCents: int(row["price_cents"], "price_cents"),
    compareAtPriceCents:
      row["compare_at_price_cents"] == null
        ? null
        : int(row["compare_at_price_cents"], "compare_at_price_cents"),
    sku: nullableStr(row["sku"], "sku"),
    description:
      typeof row["description"] === "string" ? row["description"] : "",
    trackInventory:
      typeof row["track_inventory"] === "boolean"
        ? row["track_inventory"]
        : false,
    primaryImageObjectKey: nullableStr(
      row["primary_image_object_key"],
      "primary_image_object_key",
    ),
    active: bool(row["active"], "active"),
    createdAt: instant(row["created_at"], "created_at"),
  };
}

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    slug: str(row["slug"], "slug"),
    name: str(row["name"], "name"),
    createdAt: instant(row["created_at"], "created_at"),
  };
}

function mapVariant(row: Record<string, unknown>): ProductVariant {
  const attributesRaw = object(row["attributes"] ?? {}, "attributes");
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributesRaw)) {
    if (typeof value === "string") attributes[key] = value;
  }

  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    productId: str(row["product_id"], "product_id"),
    name: str(row["name"], "name"),
    sku: nullableStr(row["sku"], "sku"),
    priceCents: int(row["price_cents"], "price_cents"),
    active: bool(row["active"], "active"),
    attributes,
  };
}

function mapImage(row: Record<string, unknown>): ProductImage {
  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    productId: str(row["product_id"], "product_id"),
    objectKey: str(row["object_key"], "object_key"),
    altText: nullableStr(row["alt_text"], "alt_text"),
    position: int(row["position"], "position"),
  };
}

function mapBanner(row: Record<string, unknown>): CatalogBanner {
  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    objectKey: str(row["object_key"], "object_key"),
    title: nullableStr(row["title"], "title"),
    subtitle: nullableStr(row["subtitle"], "subtitle"),
    linkUrl: nullableStr(row["link_url"], "link_url"),
    active: bool(row["active"], "active"),
    position: int(row["position"], "position"),
  };
}

function mapSettings(row: Record<string, unknown>): CatalogSettings {
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

function orderBy(sort: NormalizedCatalogListInput["sort"]): string {
  switch (sort) {
    case "price_asc":
      return "p.price_cents asc, p.id asc";
    case "price_desc":
      return "p.price_cents desc, p.id asc";
    case "name_asc":
      return "lower(p.name) asc, p.id asc";
    case "newest":
      return "p.created_at desc, p.id desc";
  }
}

/**
 * Repositório autoritativo do catálogo público.
 * Todas as consultas são obrigatoriamente tenant/store scoped.
 */
export class PostgresCatalogRepository implements CatalogRepository {
  constructor(private readonly sql: CatalogSqlExecutor) {}

  async isStorePubliclyAvailable(scope: CatalogScope): Promise<boolean> {
    const rows = await this.sql.query(
      `select 1
         from public.stores s
         join public.tenants t on t.id = s.tenant_id
        where s.tenant_id = $1
          and s.id = $2
          and s.status = 'active'
          and t.status in ('active', 'trial')
        limit 1`,
      [scope.tenantId, scope.storeId],
    );
    return rows.length > 0;
  }

  async getSettings(scope: CatalogScope): Promise<CatalogSettings | null> {
    const rows = await this.sql.query(
      `select
          tenant_id,
          store_id,
          layout,
          primary_color,
          accent_color,
          background_color,
          font_key,
          show_search,
          show_categories,
          show_stock,
          show_prices,
          checkout_mode,
          whatsapp_phone,
          whatsapp_message_template,
          currency,
          seo_title,
          seo_description,
          labels
         from public.catalog_settings
        where tenant_id = $1
          and store_id = $2
        limit 1`,
      [scope.tenantId, scope.storeId],
    );

    const row = rows[0];
    return row ? mapSettings(row) : defaultCatalogSettings(scope.tenantId, scope.storeId);
  }

  async listBanners(scope: CatalogScope): Promise<CatalogBanner[]> {
    const rows = await this.sql.query(
      `select
          id,
          tenant_id,
          store_id,
          object_key,
          title,
          subtitle,
          link_url,
          active,
          position
         from public.catalog_banners
        where tenant_id = $1
          and store_id = $2
          and active = true
        order by position asc, id asc`,
      [scope.tenantId, scope.storeId],
    );
    return rows.map(mapBanner);
  }

  async listCategories(scope: CatalogScope): Promise<Category[]> {
    const rows = await this.sql.query(
      `select id, tenant_id, store_id, slug, name, created_at
         from public.categories
        where tenant_id = $1
          and store_id = $2
          and active = true
        order by position asc, lower(name) asc, id asc`,
      [scope.tenantId, scope.storeId],
    );
    return rows.map(mapCategory);
  }

  async listProducts(
    scope: CatalogScope,
    input: NormalizedCatalogListInput,
  ): Promise<CatalogListResult> {
    const offset = (input.page - 1) * input.pageSize;
    const params: unknown[] = [
      scope.tenantId,
      scope.storeId,
      input.search,
      input.categorySlug,
      input.pageSize,
      offset,
    ];

    const where = `
      p.tenant_id = $1
      and p.store_id = $2
      and p.active = true
      and ($3::text is null or p.name ilike ('%' || $3::text || '%'))
      and ($4::text is null or c.slug = $4::text)
    `;

    const rows = await this.sql.query(
      `select
          p.id,
          p.tenant_id,
          p.store_id,
          p.category_id,
          p.slug,
          p.name,
          p.price_cents,
          p.compare_at_price_cents,
          p.sku,
          p.description,
          p.track_inventory,
          (
            select pi.object_key
              from public.product_images pi
             where pi.tenant_id = p.tenant_id
               and pi.store_id = p.store_id
               and pi.product_id = p.id
             order by pi.position asc, pi.id asc
             limit 1
          ) as primary_image_object_key,
          p.active,
          p.created_at
         from public.products p
         left join public.categories c
           on c.id = p.category_id
          and c.tenant_id = p.tenant_id
          and c.store_id = p.store_id
        where ${where}
        order by ${orderBy(input.sort)}
        limit $5 offset $6`,
      params,
    );

    const countRows = await this.sql.query(
      `select count(*)::bigint as total
         from public.products p
         left join public.categories c
           on c.id = p.category_id
          and c.tenant_id = p.tenant_id
          and c.store_id = p.store_id
        where ${where}`,
      params.slice(0, 4),
    );

    return {
      items: rows.map(mapProduct),
      total: int(countRows[0]?.["total"] ?? 0, "total"),
    };
  }

  async findActiveProductBySlug(scope: CatalogScope, slug: string): Promise<Product | null> {
    const rows = await this.sql.query(
      `select
          id,
          tenant_id,
          store_id,
          category_id,
          slug,
          name,
          price_cents,
          compare_at_price_cents,
          sku,
          description,
          track_inventory,
          (
            select pi.object_key
              from public.product_images pi
             where pi.tenant_id = products.tenant_id
               and pi.store_id = products.store_id
               and pi.product_id = products.id
             order by pi.position asc, pi.id asc
             limit 1
          ) as primary_image_object_key,
          active,
          created_at
         from public.products
        where tenant_id = $1
          and store_id = $2
          and slug = $3
          and active = true
        limit 1`,
      [scope.tenantId, scope.storeId, slug],
    );

    const row = rows[0];
    return row ? mapProduct(row) : null;
  }

  async listProductVariants(
    scope: CatalogScope,
    productId: string,
  ): Promise<ProductVariant[]> {
    const rows = await this.sql.query(
      `select
          id,
          tenant_id,
          store_id,
          product_id,
          name,
          sku,
          attributes,
          price_cents,
          active
         from public.product_variants
        where tenant_id = $1
          and store_id = $2
          and product_id = $3
          and active = true
        order by position asc, id asc`,
      [scope.tenantId, scope.storeId, productId],
    );
    return rows.map(mapVariant);
  }

  async listProductImages(
    scope: CatalogScope,
    productId: string,
  ): Promise<ProductImage[]> {
    const rows = await this.sql.query(
      `select
          id,
          tenant_id,
          store_id,
          product_id,
          object_key,
          alt_text,
          position
         from public.product_images
        where tenant_id = $1
          and store_id = $2
          and product_id = $3
        order by position asc, id asc`,
      [scope.tenantId, scope.storeId, productId],
    );
    return rows.map(mapImage);
  }
}
