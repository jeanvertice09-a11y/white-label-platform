import { describe, expect, test } from "bun:test";
import {
  CatalogUnavailableError,
  PostgresCatalogRepository,
  loadPublicCatalog,
  loadPublicProduct,
  normalizeCatalogListInput,
} from "../../packages/catalog/src/index.ts";
import type {
  CatalogRepository,
  CatalogScope,
  NormalizedCatalogListInput,
} from "../../packages/catalog/src/index.ts";

const SCOPE: CatalogScope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  storeId: "22222222-2222-4222-8222-222222222222",
};

const PRODUCT = {
  id: "33333333-3333-4333-8333-333333333333",
  tenantId: SCOPE.tenantId,
  storeId: SCOPE.storeId,
  categoryId: null,
  slug: "camiseta-preta",
  name: "Camiseta Preta",
  priceCents: 1299,
  active: true,
  createdAt: "2026-09-17T00:00:00.000Z",
};

function repository(available = true): CatalogRepository {
  return {
    isStorePubliclyAvailable: () => Promise.resolve(available),
    listCategories: () =>
      Promise.resolve([
        {
          id: "44444444-4444-4444-8444-444444444444",
          tenantId: SCOPE.tenantId,
          storeId: SCOPE.storeId,
          slug: "roupas",
          name: "Roupas",
          createdAt: "2026-09-17T00:00:00.000Z",
        },
      ]),
    listProducts: (
      _scope: CatalogScope,
      _input: NormalizedCatalogListInput,
    ) => Promise.resolve({ items: [PRODUCT], total: 1 }),
    findActiveProductBySlug: (_scope: CatalogScope, slug: string) =>
      Promise.resolve(slug === PRODUCT.slug ? PRODUCT : null),
  };
}

describe("catalog query normalization", () => {
  test("normaliza defaults e busca", () => {
    expect(normalizeCatalogListInput({ search: "  camiseta  " })).toEqual({
      page: 1,
      pageSize: 24,
      search: "camiseta",
      categorySlug: null,
      sort: "newest",
    });
  });

  test("rejeita paginação e categoria inválidas", () => {
    expect(() => normalizeCatalogListInput({ page: 0 })).toThrow();
    expect(() => normalizeCatalogListInput({ pageSize: 49 })).toThrow();
    expect(() => normalizeCatalogListInput({ categorySlug: "../outra-loja" })).toThrow();
  });
});

describe("public catalog service", () => {
  test("retorna snapshot paginado somente para loja disponível", async () => {
    const result = await loadPublicCatalog(
      SCOPE,
      { page: 1, pageSize: 24, categorySlug: "roupas" },
      repository(),
    );

    expect(result.products.total).toBe(1);
    expect(result.products.totalPages).toBe(1);
    expect(result.products.items[0]?.storeId).toBe(SCOPE.storeId);
    expect(result.categories[0]?.tenantId).toBe(SCOPE.tenantId);
  });

  test("falha fechado quando tenant/store não está disponível", async () => {
    await expect(
      loadPublicCatalog(SCOPE, {}, repository(false)),
    ).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  test("produto público precisa existir e estar ativo no escopo", async () => {
    const product = await loadPublicProduct(SCOPE, "camiseta-preta", repository());
    expect(product.id).toBe(PRODUCT.id);

    await expect(
      loadPublicProduct(SCOPE, "produto-inexistente", repository()),
    ).rejects.toThrow("Produto não encontrado");
  });
});

describe("PostgresCatalogRepository", () => {
  test("todas as consultas carregam tenantId + storeId como escopo", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql = {
      query(query: string, params: unknown[]): Promise<Record<string, unknown>[]> {
        calls.push({ sql: query, params });

        if (query.includes("select 1")) return Promise.resolve([{ "?column?": 1 }]);
        if (query.includes("count(*)")) return Promise.resolve([{ total: "0" }]);
        return Promise.resolve([]);
      },
    };

    const repo = new PostgresCatalogRepository(sql);
    expect(await repo.isStorePubliclyAvailable(SCOPE)).toBe(true);
    await repo.listCategories(SCOPE);
    await repo.listProducts(SCOPE, normalizeCatalogListInput({}));
    await repo.findActiveProductBySlug(SCOPE, "camiseta-preta");

    expect(calls.length).toBe(5);
    for (const call of calls) {
      expect(call.params[0]).toBe(SCOPE.tenantId);
      expect(call.params[1]).toBe(SCOPE.storeId);
    }
  });

  test("mapeia produto ativo sem perder preço em centavos", async () => {
    const sql = {
      query(): Promise<Record<string, unknown>[]> {
        return Promise.resolve([
          {
            id: PRODUCT.id,
            tenant_id: SCOPE.tenantId,
            store_id: SCOPE.storeId,
            category_id: null,
            slug: PRODUCT.slug,
            name: PRODUCT.name,
            price_cents: "1299",
            active: true,
            created_at: PRODUCT.createdAt,
          },
        ]);
      },
    };

    const repo = new PostgresCatalogRepository(sql);
    const product = await repo.findActiveProductBySlug(SCOPE, PRODUCT.slug);

    expect(product?.priceCents).toBe(1299);
    expect(product?.tenantId).toBe(SCOPE.tenantId);
    expect(product?.storeId).toBe(SCOPE.storeId);
  });
});
