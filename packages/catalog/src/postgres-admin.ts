import type { CatalogSqlExecutor } from "./repository.ts";
import type { CatalogAdminRepository } from "./admin-repository.ts";
import {
  createCategory,
  createProduct,
  createVariant,
  updateCategory,
  updateProduct,
  updateVariant,
} from "./postgres-write-products.ts";
import {
  createBanner,
  updateBanner,
  updateSettings,
} from "./postgres-write-store.ts";

export function createCatalogAdminRepository(
  sql: CatalogSqlExecutor,
): CatalogAdminRepository {
  return {
    createProduct: (scope, input) => createProduct(sql, scope, input),
    updateProduct: (scope, id, input) => updateProduct(sql, scope, id, input),
    createVariant: (scope, input) => createVariant(sql, scope, input),
    updateVariant: (scope, id, input) => updateVariant(sql, scope, id, input),
    createCategory: (scope, input) => createCategory(sql, scope, input),
    updateCategory: (scope, id, input) => updateCategory(sql, scope, id, input),
    createBanner: (scope, input) => createBanner(sql, scope, input),
    updateBanner: (scope, id, input) => updateBanner(sql, scope, id, input),
    updateSettings: (scope, input) => updateSettings(sql, scope, input),
  };
}
