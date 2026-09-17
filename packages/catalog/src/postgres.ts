import type { CatalogRepository, CatalogListResult } from "./repository.ts";
import type {
  CatalogScope,
  Category,
  NormalizedCatalogListInput,
  Product,
} from "./types.ts";

export interface CatalogSqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

function str(value: unknown, column: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`coluna inválida: ${column}`);
  }
  return value;
}

function nullableStr(value: unknown, column: string): string | null {
  if (value === null) return null;
  return str(value, column);
}

function int(value: unknown, column: string): number {
  const parsed =
    typeof value === "bigint"
      ? Number(value)
      : typeof value === "string"
        ? Number(value)
        : typeof value === "number"
          ? value
          : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`coluna inválida: ${column}`);
  }
  return parsed;
}

function instant(value: unknown, column: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error(`coluna inválida: ${column}`);
}

function bool(value: unknown, column: string): boolean {
  if (typeof value !== "boolean") throw new Error(`coluna inválida: ${column}`);
  return value;
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    categoryId: nullableStr(row["category_id"], "category_id"),
    slug: str(row["slug"], "slug"),
    name: str(row["name"], "name"),
    priceCents: int(row["price_cents"], "price_cents"),
    active: bool(row["active"], "active"),
    createdAt: instant(row["created_at"], "created_at"),
  };
}

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: str(row["id"], "id"),
    tenantId: str(row["tenant_id"], "tenant_id"),
    storeId: str(row["store_id"], "store_id"),
    slug: str(row["slug"], "slug"),
    name: str(row["name"], "name"),
    createdAt: instant(row["created_at"], "created_at"),
  };
}

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

/**
 * Repositório autoritativo do catálogo público.
 * Todas as consultas são obrigatoriamente tenant/store scoped.
 */
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

  async listCategories(scope: CatalogScope): Promise<Category[]> {
    const rows = await this.sql.query(
      `select id, tenant_id, store_id, slug, name, created_at
         from public.categories
        where tenant_id = $1
          and store_id = $2
        order by lower(name) asc, id asc`,
      [scope.tenantId, scope.storeId],
    );
    return rows.map(mapCategory);
  }

  async listProducts(
    scope: CatalogScope,
    input: NormalizedCatalogListInput,
  ): Promise<CatalogListResult> {
    const offset = (input.page - 1) * input.pageSize;
    const params: unknown[] = [
      scope.tenantId,
      scope.storeId,
      input.search,
      input.categorySlug,
      input.pageSize,
      offset,
    ];

    const where = `
      p.tenant_id = $1
      and p.store_id = $2
      and p.active = true
      and ($3::text is null or p.name ilike ('%' || $3::text || '%'))
      and ($4::text is null or c.slug = $4::text)
    `;

    const rows = await this.sql.query(
      `select
          p.id,
          p.tenant_id,
          p.store_id,
          p.category_id,
          p.slug,
          p.name,
          p.price_cents,
          p.active,
          p.created_at
         from public.products p
         left join public.categories c
           on c.id = p.category_id
          and c.tenant_id = p.tenant_id
          and c.store_id = p.store_id
        where ${where}
        order by ${orderBy(input.sort)}
        limit $5 offset $6`,
      params,
    );

    const countRows = await this.sql.query(
      `select count(*)::bigint as total
         from public.products p
         left join public.categories c
           on c.id = p.category_id
          and c.tenant_id = p.tenant_id
          and c.store_id = p.store_id
        where ${where}`,
      params.slice(0, 4),
    );

    return {
      items: rows.map(mapProduct),
      total: int(countRows[0]?.["total"] ?? 0, "total"),
    };
  }

  async findActiveProductBySlug(scope: CatalogScope, slug: string): Promise<Product | null> {
    const rows = await this.sql.query(
      `select
          id,
          tenant_id,
          store_id,
          category_id,
          slug,
          name,
          price_cents,
          active,
          created_at
         from public.products
        where tenant_id = $1
          and store_id = $2
          and slug = $3
          and active = true
        limit 1`,
      [scope.tenantId, scope.storeId, slug],
    );

    const row = rows[0];
    return row ? mapProduct(row) : null;
  }
}
