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
} from "./types.ts";
import { defaultCatalogSettings } from "./storefront.ts";
import type {
  CatalogProductDetail,
  PublicStorefrontSnapshot,
} from "./storefront.ts";

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
 * Carrega a vitrine pública completa.
 * O scope vem do hostname resolvido no servidor, nunca de query/body do browser.
 */
export async function loadPublicCatalog(
  scope: CatalogScope,
  input: CatalogListInput,
  repository: CatalogRepository,
): Promise<PublicStorefrontSnapshot> {
  await assertCatalogAvailable(scope, repository);
  const normalized = normalizeCatalogListInput(input);

  const [settingsValue, banners, categories, productsResult] = await Promise.all([
    repository.getSettings(scope),
    repository.listBanners(scope),
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

  const settings =
    settingsValue ?? defaultCatalogSettings(scope.tenantId, scope.storeId);

  return { settings, banners, categories, products };
}

/**
 * Compatibilidade: retorna somente o produto ativo.
 * Para a página de detalhe prefira loadPublicProductDetail.
 */
export async function loadPublicProduct(
  scope: CatalogScope,
  slug: string,
  repository: CatalogRepository,
): Promise<Product> {
  const detail = await loadPublicProductDetail(scope, slug, repository);
  return detail.product;
}

export async function loadPublicProductDetail(
  scope: CatalogScope,
  slug: string,
  repository: CatalogRepository,
): Promise<CatalogProductDetail> {
  await assertCatalogAvailable(scope, repository);

  const normalizedSlug = slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
    throw new CatalogProductNotFoundError();
  }

  const product = await repository.findActiveProductBySlug(scope, normalizedSlug);
  if (!product) throw new CatalogProductNotFoundError();

  const [variants, images] = await Promise.all([
    repository.listProductVariants(scope, product.id),
    repository.listProductImages(scope, product.id),
  ]);

  return { product, variants, images };
}
