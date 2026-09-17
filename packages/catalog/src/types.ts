export type CatalogSort = "newest" | "price_asc" | "price_desc" | "name_asc";

export interface Product {
  id: string;
  tenantId: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  priceCents: number;
  active: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  slug: string;
  createdAt: string;
}

/** Escopo já resolvido pelo hostname no servidor. */
export interface CatalogScope {
  tenantId: string;
  storeId: string;
}

/** Compatibilidade com a fundação anterior. */
export interface CatalogQuery extends CatalogScope {
  page: number;
  pageSize: number;
}

export interface CatalogListInput {
  page?: number;
  pageSize?: number;
  search?: string;
  categorySlug?: string;
  sort?: CatalogSort;
}

export interface NormalizedCatalogListInput {
  page: number;
  pageSize: number;
  search: string | null;
  categorySlug: string | null;
  sort: CatalogSort;
}

export interface CatalogPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PublicCatalogSnapshot {
  categories: Category[];
  products: CatalogPage<Product>;
}

export function assertCatalogScope(q: CatalogScope): void {
  if (!q.tenantId || !q.storeId) {
    throw new Error("Catálogo exige tenantId+storeId resolvidos");
  }
}

export function normalizeCatalogListInput(input: CatalogListInput = {}): NormalizedCatalogListInput {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 24;

  if (!Number.isInteger(page) || page < 1) {
    throw new Error("Página inválida");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) {
    throw new Error("Tamanho de página inválido");
  }

  const search = input.search?.trim() || null;
  if (search && search.length > 120) {
    throw new Error("Busca muito longa");
  }

  const categorySlug = input.categorySlug?.trim() || null;
  if (categorySlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categorySlug)) {
    throw new Error("Categoria inválida");
  }

  const sort = input.sort ?? "newest";
  if (!["newest", "price_asc", "price_desc", "name_asc"].includes(sort)) {
    throw new Error("Ordenação inválida");
  }

  return { page, pageSize, search, categorySlug, sort };
}
