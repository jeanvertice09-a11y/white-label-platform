export interface Product {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  slug: string;
  priceCents: number;
  active: boolean;
}

export interface Category {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  slug: string;
}

/** Catálogo público: leitura sempre via domínio resolvido (tenant/store scoped). */
export interface CatalogQuery {
  tenantId: string;
  storeId: string;
  page: number;
  pageSize: number;
}

export function assertCatalogScope(q: CatalogQuery): void {
  if (!q.tenantId || !q.storeId) throw new Error("Catálogo exige tenantId+storeId resolvidos");
  if (q.page < 1 || q.pageSize < 1 || q.pageSize > 100) throw new Error("Paginação inválida");
}
