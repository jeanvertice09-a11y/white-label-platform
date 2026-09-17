import type { CatalogRepository } from "./repository.ts";
import {
  assertCatalogScope,
  normalizeCatalogListInput,
} from "./types.ts";
import type {
  CatalogListInput,
  CatalogPage,
  CatalogScope,
  Product,
  PublicCatalogSnapshot,
} from "./types.ts";

export class CatalogUnavailableError extends Error {
  constructor() {
    super("Catálogo indisponível");
    this.name = "CatalogUnavailableError";
  }
}

export class CatalogProductNotFoundError extends Error {
  constructor() {
    super("Produto não encontrado");
    this.name = "CatalogProductNotFoundError";
  }
}

async function assertCatalogAvailable(
  scope: CatalogScope,
  repository: CatalogRepository,
): Promise<void> {
  assertCatalogScope(scope);
  const available = await repository.isStorePubliclyAvailable(scope);
  if (!available) throw new CatalogUnavailableError();
}

/**
 * Carrega a página pública do catálogo.
 * O scope deve vir do hostname resolvido no servidor, nunca do browser.
 */
export async function loadPublicCatalog(
  scope: CatalogScope,
  input: CatalogListInput,
  repository: CatalogRepository,
): Promise<PublicCatalogSnapshot> {
  await assertCatalogAvailable(scope, repository);
  const normalized = normalizeCatalogListInput(input);

  const [categories, productsResult] = await Promise.all([
    repository.listCategories(scope),
    repository.listProducts(scope, normalized),
  ]);

  const totalPages =
    productsResult.total === 0
      ? 0
      : Math.ceil(productsResult.total / normalized.pageSize);

  const products: CatalogPage<Product> = {
    items: productsResult.items,
    page: normalized.page,
    pageSize: normalized.pageSize,
    total: productsResult.total,
    totalPages,
  };

  return { categories, products };
}

export async function loadPublicProduct(
  scope: CatalogScope,
  slug: string,
  repository: CatalogRepository,
): Promise<Product> {
  await assertCatalogAvailable(scope, repository);

  const normalizedSlug = slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
    throw new CatalogProductNotFoundError();
  }

  const product = await repository.findActiveProductBySlug(scope, normalizedSlug);
  if (!product) throw new CatalogProductNotFoundError();
  return product;
}
