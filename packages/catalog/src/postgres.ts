import type { CatalogListResult, CatalogRepository } from "./repository.ts";
import type {
  CatalogScope,
  Category,
  NormalizedCatalogListInput,
  Product,
} from "./types.ts";
import type {
  CatalogBanner,
  CatalogSettings,
  ProductImage,
} from "./storefront.ts";
import { defaultCatalogSettings } from "./storefront.ts";
import type { ProductVariant } from "./pricing.ts";
import {
  intValue,
  mapBanner,
  mapCategory,
  mapImage,
  mapProduct,
  mapSettings,
  mapVariant,
} from "./postgres-mappers.ts";

export interface CatalogSqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

const PRODUCT_SELECT = `
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
`;

const PRODUCT_WHERE = `
  p.tenant_id = $1
  and p.store_id = $2
  and p.active = true
  and ($3::text is null or p.name ilike ('%' || $3::text || '%'))
  and ($4::text is null or c.slug = $4::text)
`;

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
          tenant_id, store_id, layout, primary_color, accent_color,
          background_color, font_key, show_search, show_categories,
          show_stock, show_prices, checkout_mode, whatsapp_phone,
          whatsapp_message_template, currency, seo_title, seo_description, labels
         from public.catalog_settings
        where tenant_id = $1 and store_id = $2
        limit 1`,
      [scope.tenantId, scope.storeId],
    );

    if (rows.length === 0) {
      return defaultCatalogSettings(scope.tenantId, scope.storeId);
    }
    return mapSettings(rows[0]);
  }

  async listBanners(scope: CatalogScope): Promise<CatalogBanner[]> {
    const rows = await this.sql.query(
      `select id, tenant_id, store_id, object_key, title, subtitle,
              link_url, active, position
         from public.catalog_banners
        where tenant_id = $1 and store_id = $2 and active = true
        order by position asc, id asc`,
      [scope.tenantId, scope.storeId],
    );
    return rows.map(mapBanner);
  }

  async listCategories(scope: CatalogScope): Promise<Category[]> {
    const rows = await this.sql.query(
      `select id, tenant_id, store_id, slug, name, created_at
         from public.categories
        where tenant_id = $1 and store_id = $2 and active = true
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
    const filters = [
      scope.tenantId,
      scope.storeId,
      input.search,
      input.categorySlug,
    ];
    const rows = await this.sql.query(
      `select ${PRODUCT_SELECT}
         from public.products p
         left join public.categories c
           on c.id = p.category_id
          and c.tenant_id = p.tenant_id
          and c.store_id = p.store_id
        where ${PRODUCT_WHERE}
        order by ${orderBy(input.sort)}
        limit $5 offset $6`,
      [...filters, input.pageSize, offset],
    );
    const countRows = await this.sql.query(
      `select count(*)::bigint as total
         from public.products p
         left join public.categories c
           on c.id = p.category_id
          and c.tenant_id = p.tenant_id
          and c.store_id = p.store_id
        where ${PRODUCT_WHERE}`,
      filters,
    );

    return {
      items: rows.map(mapProduct),
      total: intValue(countRows[0]?.["total"] ?? 0, "total"),
    };
  }

  async findActiveProductBySlug(
    scope: CatalogScope,
    slug: string,
  ): Promise<Product | null> {
    const rows = await this.sql.query(
      `select ${PRODUCT_SELECT}
         from public.products p
        where p.tenant_id = $1
          and p.store_id = $2
          and p.slug = $3
          and p.active = true
        limit 1`,
      [scope.tenantId, scope.storeId, slug],
    );
    if (rows.length === 0) return null;
    return mapProduct(rows[0]);
  }

  async listProductVariants(
    scope: CatalogScope,
    productId: string,
  ): Promise<ProductVariant[]> {
    const rows = await this.sql.query(
      `select id, tenant_id, store_id, product_id, name, sku,
              attributes, price_cents, active
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
      `select id, tenant_id, store_id, product_id, object_key, alt_text, position
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
