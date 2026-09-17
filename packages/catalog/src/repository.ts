import type {
  CatalogScope,
  Category,
  NormalizedCatalogListInput,
  Product,
} from "./types.ts";

export interface CatalogListResult {
  items: Product[];
  total: number;
}

/**
 * Boundary de persistência do catálogo público.
 *
 * Toda operação recebe tenantId + storeId já resolvidos pelo hostname.
 * Implementações nunca devem buscar produtos apenas por slug/id sem o escopo.
 */
export interface CatalogRepository {
  isStorePubliclyAvailable(scope: CatalogScope): Promise<boolean>;
  listCategories(scope: CatalogScope): Promise<Category[]>;
  listProducts(
    scope: CatalogScope,
    input: NormalizedCatalogListInput,
  ): Promise<CatalogListResult>;
  findActiveProductBySlug(scope: CatalogScope, slug: string): Promise<Product | null>;
}
