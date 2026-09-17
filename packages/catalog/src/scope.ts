import type { CatalogQuery, CatalogScope } from "./types.ts";

export class CatalogScopeError extends Error {
  readonly code = "CATALOG_SCOPE_INVALID";
}

export function assertCatalogScope(scope: CatalogScope): void {
  if (!scope.tenantId || !scope.storeId) {
    throw new CatalogScopeError("Catálogo exige tenantId+storeId resolvidos");
  }
}

export function assertSameCatalogScope(expected: CatalogScope, actual: CatalogScope): void {
  assertCatalogScope(expected);
  assertCatalogScope(actual);
  if (expected.tenantId !== actual.tenantId || expected.storeId !== actual.storeId) {
    throw new CatalogScopeError("Acesso cross-tenant/store negado");
  }
}

export function assertCatalogQuery(query: CatalogQuery): void {
  assertCatalogScope(query);
  if (query.page < 1 || query.pageSize < 1 || query.pageSize > 100) {
    throw new CatalogScopeError("Paginação inválida");
  }
  if (query.search !== undefined && query.search.trim().length > 120) {
    throw new CatalogScopeError("Busca inválida");
  }
}
