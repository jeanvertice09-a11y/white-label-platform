import { assertCatalogQuery, assertCatalogScope } from "./scope.ts";
import { defaultCatalogSettings } from "./defaults.ts";
import {
  mapBanner,
  mapCategory,
  mapImage,
  mapProduct,
  mapSettings,
  mapStore,
  mapVariant,
} from "./postgres-mappers.ts";
import type {
  CatalogPage,
  CatalogQuery,
  CatalogScope,
  CatalogSettings,
  Category,
  Product,
  StoreBanner,
  StorefrontStore,
} from "./types.ts";
import type { CatalogReadRepository, CatalogSqlExecutor } from "./repository.ts";

async function hydrateProducts(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  products: Product[],
  publicOnly: boolean,
): Promise<Product[]> {
  if (products.length === 0) return products;
  const ids = products.map((product) => product.id);
  const active = publicOnly ? " and active=true" : "";
  const variants = await sql.query(
    "select id,tenant_id,store_id,product_id,name,sku,attributes,price_cents," +
      "compare_at_price_cents,cost_cents,active,stock_quantity,position " +
      "from public.product_variants where tenant_id=$1 and store_id=$2 " +
      "and product_id=any($3::uuid[])" + active + " order by position,name",
    [scope.tenantId, scope.storeId, ids],
  );
  const images = await sql.query(
    "select id,tenant_id,store_id,product_id,variant_id,object_key,alt_text,position " +
      "from public.product_images where tenant_id=$1 and store_id=$2 " +
      "and product_id=any($3::uuid[]) order by position,id",
    [scope.tenantId, scope.storeId, ids],
  );
  return products.map((product) => ({
    ...product,
    variants: variants.filter((row) => row["product_id"] === product.id).map(mapVariant),
    images: images.filter((row) => row["product_id"] === product.id).map(mapImage),
  }));
}

function publicProductFilter(): string {
  return "p.active=true and (p.category_id is null or exists (" +
    "select 1 from public.categories c where c.tenant_id=p.tenant_id " +
    "and c.store_id=p.store_id and c.id=p.category_id and c.active=true))";
}

async function getProduct(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  field: "id" | "slug",
  value: string,
  publicOnly: boolean,
): Promise<Product | null> {
  assertCatalogScope(scope);
  const filter = publicOnly ? " and " + publicProductFilter() : "";
  const rows = await sql.query(
    "select p.id,p.tenant_id,p.store_id,p.name,p.slug,p.description,p.sku,p.category_id," +
      "p.price_cents,p.compare_at_price_cents,p.cost_cents,p.active,p.track_inventory," +
      "p.stock_quantity,p.position from public.products p where p.tenant_id=$1 " +
      "and p.store_id=$2 and p." + field + "=$3" + filter + " limit 1",
    [scope.tenantId, scope.storeId, value],
  );
  if (!rows[0]) return null;
  const hydrated = await hydrateProducts(sql, scope, [mapProduct(rows[0])], publicOnly);
  return hydrated[0] ?? null;
}

async function getStore(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
): Promise<StorefrontStore | null> {
  assertCatalogScope(scope);
  const rows = await sql.query(
    "select s.tenant_id,s.id as store_id,s.name,s.slug,t.status as tenant_status," +
      "s.status as store_status,t.trial_ends_at from public.stores s " +
      "join public.tenants t on t.id=s.tenant_id where s.tenant_id=$1 and s.id=$2 limit 1",
    [scope.tenantId, scope.storeId],
  );
  return rows[0] ? mapStore(rows[0]) : null;
}

async function getSettings(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
): Promise<CatalogSettings> {
  assertCatalogScope(scope);
  const rows = await sql.query(
    "select tenant_id,store_id,layout,primary_color,accent_color,background_color," +
      "font_family,show_search,show_categories,show_price,show_stock,labels,whatsapp_phone," +
      "whatsapp_message,checkout_mode,seo_title,seo_description from public.catalog_settings " +
      "where tenant_id=$1 and store_id=$2 limit 1",
    [scope.tenantId, scope.storeId],
  );
  return rows[0] ? mapSettings(rows[0]) : defaultCatalogSettings(scope);
}

async function listCategories(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  publicOnly: boolean,
): Promise<Category[]> {
  assertCatalogScope(scope);
  const active = publicOnly ? " and active=true" : "";
  const rows = await sql.query(
    "select id,tenant_id,store_id,name,slug,description,parent_id,active,position " +
      "from public.categories where tenant_id=$1 and store_id=$2" + active +
      " order by position,name",
    [scope.tenantId, scope.storeId],
  );
  return rows.map(mapCategory);
}

async function listBanners(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  publicOnly: boolean,
): Promise<StoreBanner[]> {
  assertCatalogScope(scope);
  const active = publicOnly ? " and active=true" : "";
  const rows = await sql.query(
    "select id,tenant_id,store_id,title,alt_text,image_object_key,href,active,position " +
      "from public.store_banners where tenant_id=$1 and store_id=$2" + active +
      " order by position,id",
    [scope.tenantId, scope.storeId],
  );
  return rows.map(mapBanner);
}

function productWhere(query: CatalogQuery, publicOnly: boolean) {
  const where = ["p.tenant_id=$1", "p.store_id=$2"];
  const params: unknown[] = [query.tenantId, query.storeId];
  if (publicOnly) where.push(publicProductFilter());
  if (query.search?.trim()) {
    params.push("%" + query.search.trim() + "%");
    const index = String(params.length);
    where.push("(p.name ilike $" + index + " or coalesce(p.sku,'') ilike $" + index + ")");
  }
  if (query.categoryId) {
    params.push(query.categoryId);
    where.push("p.category_id=$" + String(params.length));
  }
  return { where, params };
}

async function listProducts(
  sql: CatalogSqlExecutor,
  query: CatalogQuery,
  publicOnly: boolean,
): Promise<CatalogPage> {
  assertCatalogQuery(query);
  const { where, params } = productWhere(query, publicOnly);
  const orders = {
    position: "p.position asc,p.name asc",
    name: "p.name asc",
    price_asc: "p.price_cents asc,p.name asc",
    price_desc: "p.price_cents desc,p.name asc",
  } as const;
  params.push(query.pageSize, (query.page - 1) * query.pageSize);
  const limit = String(params.length - 1);
  const offset = String(params.length);
  const rows = await sql.query(
    "select p.id,p.tenant_id,p.store_id,p.name,p.slug,p.description,p.sku,p.category_id," +
      "p.price_cents,p.compare_at_price_cents,p.cost_cents,p.active,p.track_inventory," +
      "p.stock_quantity,p.position,count(*) over() as total_count from public.products p " +
      "where " + where.join(" and ") + " order by " + orders[query.sort ?? "position"] +
      " limit $" + limit + " offset $" + offset,
    params,
  );
  return {
    items: await hydrateProducts(sql, query, rows.map(mapProduct), publicOnly),
    page: query.page,
    pageSize: query.pageSize,
    total: rows[0] ? Number(rows[0]["total_count"]) : 0,
  };
}

export function createCatalogReadRepository(sql: CatalogSqlExecutor): CatalogReadRepository {
  return {
    getStore: (scope) => getStore(sql, scope),
    getSettings: (scope) => getSettings(sql, scope),
    listCategories: (scope, publicOnly) => listCategories(sql, scope, publicOnly),
    listBanners: (scope, publicOnly) => listBanners(sql, scope, publicOnly),
    listProducts: (query, publicOnly) => listProducts(sql, query, publicOnly),
    getProductBySlug: (scope, slug, publicOnly) =>
      getProduct(sql, scope, "slug", slug, publicOnly),
    getProductById: (scope, id) => getProduct(sql, scope, "id", id, false),
  };
}
