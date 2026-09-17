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

export interface CatalogSqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface CatalogReadRepository {
  getStore(scope: CatalogScope): Promise<StorefrontStore | null>;
  getSettings(scope: CatalogScope): Promise<CatalogSettings>;
  listCategories(scope: CatalogScope, publicOnly: boolean): Promise<Category[]>;
  listBanners(scope: CatalogScope, publicOnly: boolean): Promise<StoreBanner[]>;
  listProducts(query: CatalogQuery, publicOnly: boolean): Promise<CatalogPage>;
  getProductBySlug(
    scope: CatalogScope,
    slug: string,
    publicOnly: boolean,
  ): Promise<Product | null>;
  getProductById(scope: CatalogScope, id: string): Promise<Product | null>;
}
