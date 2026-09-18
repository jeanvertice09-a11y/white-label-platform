import { describe, expect, test } from "bun:test";
import { createCatalogAdminRepository } from "../../packages/catalog/src/postgres-admin.ts";
import type { CatalogSqlExecutor } from "../../packages/catalog/src/repository.ts";
import type { ProductMutationInput, VariantMutationInput } from "../../packages/catalog/src/admin-types.ts";

const scope = { tenantId: "tenant-a", storeId: "store-a" };

const productInput: ProductMutationInput = {
  name: "Produto",
  slug: "produto",
  description: null,
  sku: null,
  categoryId: null,
  priceCents: 1000,
  compareAtPriceCents: null,
  costCents: null,
  active: true,
  trackInventory: false,
  stockQuantity: 0,
  position: 0,
};

const variantInput: VariantMutationInput = {
  productId: "product-a",
  name: "Azul P",
  sku: "AZ-P",
  attributes: { cor: "Azul", tamanho: "P" },
  priceCents: 1299,
  compareAtPriceCents: null,
  costCents: null,
  active: true,
  stockQuantity: 3,
  position: 0,
};

function productRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "product-a",
    tenant_id: "tenant-a",
    store_id: "store-a",
    name: "Produto",
    slug: "produto",
    description: null,
    sku: null,
    category_id: null,
    price_cents: 1000,
    compare_at_price_cents: null,
    cost_cents: null,
    active: true,
    track_inventory: false,
    stock_quantity: 0,
    position: 0,
    ...overrides,
  };
}

async function expectRejected(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
    throw new Error("Esperava rejeição");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(message);
  }
}

describe("catalog admin repository scope", () => {
  test("cria produto dentro do tenant/store atual", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql: CatalogSqlExecutor = {
      query(statement, params) {
        calls.push({ sql: statement, params });
        return Promise.resolve([productRow()]);
      },
    };
    const repository = createCatalogAdminRepository(sql);
    const created = await repository.createProduct(scope, productInput);
    expect(created.storeId).toBe("store-a");
    expect(calls[0]?.params.slice(0, 2)).toEqual(["tenant-a", "store-a"]);
  });

  test("update de produto sempre usa tenant/store/id no WHERE", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql: CatalogSqlExecutor = {
      query(statement, params) {
        calls.push({ sql: statement, params });
        return Promise.resolve([productRow({ name: "Produto editado" })]);
      },
    };
    const repository = createCatalogAdminRepository(sql);
    const updated = await repository.updateProduct(scope, "product-a", {
      ...productInput,
      name: "Produto editado",
    });
    expect(updated?.name).toBe("Produto editado");
    expect(calls[0]?.params.slice(0, 3)).toEqual(["tenant-a", "store-a", "product-a"]);
    expect(calls[0]?.sql).toContain("where tenant_id=$1 and store_id=$2 and id=$3");
    expect(calls[0]?.sql).not.toContain("stock_quantity=$");
  });

  test("cria categoria própria", async () => {
    const sql: CatalogSqlExecutor = {
      query(statement) {
        if (!statement.includes("insert into public.categories")) throw new Error("SQL inesperado");
        return Promise.resolve([{ id: "category-a", tenant_id: "tenant-a", store_id: "store-a", name: "Roupas", slug: "roupas", description: null, parent_id: null, active: true, position: 0 }]);
      },
    };
    const repository = createCatalogAdminRepository(sql);
    const created = await repository.createCategory(scope, { name: "Roupas", slug: "roupas", description: null, parentId: null, active: true, position: 0 });
    expect(created.id).toBe("category-a");
    expect(created.storeId).toBe("store-a");
  });

  test("cria e edita variante no produto correto", async () => {
    let inserts = 0;
    const sql: CatalogSqlExecutor = {
      query(statement) {
        if (statement.includes("from public.products")) return Promise.resolve([{ id: "product-a" }]);
        if (statement.includes("from public.product_variants")) return Promise.resolve([]);
        if (statement.includes("insert into public.product_variants")) {
          inserts += 1;
          return Promise.resolve([{ id: "variant-a", tenant_id: "tenant-a", store_id: "store-a", product_id: "product-a", name: "Azul P", sku: "AZ-P", attributes: { cor: "Azul", tamanho: "P" }, price_cents: 1299, compare_at_price_cents: null, cost_cents: null, active: true, stock_quantity: 0, position: 0 }]);
        }
        if (statement.includes("update public.product_variants")) {
          return Promise.resolve([{ id: "variant-a", tenant_id: "tenant-a", store_id: "store-a", product_id: "product-a", name: "Azul P", sku: "AZ-P", attributes: { cor: "Azul", tamanho: "P" }, price_cents: 1399, compare_at_price_cents: null, cost_cents: null, active: true, stock_quantity: 0, position: 0 }]);
        }
        throw new Error("SQL inesperado");
      },
    };
    const repository = createCatalogAdminRepository(sql);
    const created = await repository.createVariant(scope, variantInput);
    const updated = await repository.updateVariant(scope, created.id, { ...variantInput, priceCents: 1399 });
    expect(inserts).toBe(1);
    expect(created.productId).toBe("product-a");
    expect(updated?.priceCents).toBe(1399);
  });

  test("IDOR por productId de outra store/tenant não atualiza produto", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql: CatalogSqlExecutor = {
      query(statement, params) {
        calls.push({ sql: statement, params });
        return Promise.resolve([]);
      },
    };
    const repository = createCatalogAdminRepository(sql);
    const updated = await repository.updateProduct(scope, "product-b", productInput);
    expect(updated).toBeNull();
    expect(calls[0]?.sql).toContain("where tenant_id=$1 and store_id=$2 and id=$3");
    expect(calls[0]?.params.slice(0, 3)).toEqual(["tenant-a", "store-a", "product-b"]);
  });

  test("categoria de outra store/tenant é rejeitada antes de criar produto", async () => {
    const calls: string[] = [];
    const sql: CatalogSqlExecutor = {
      query(statement) {
        calls.push(statement);
        return Promise.resolve([]);
      },
    };
    const repository = createCatalogAdminRepository(sql);
    await expectRejected(
      repository.createProduct(scope, { ...productInput, categoryId: "category-b" }),
      "Categoria não pertence",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("tenant_id=$1 and store_id=$2 and id=$3");
  });

  test("productId de outra store/tenant é rejeitado antes de criar variante", async () => {
    const calls: string[] = [];
    const sql: CatalogSqlExecutor = {
      query(statement) {
        calls.push(statement);
        return Promise.resolve([]);
      },
    };
    const repository = createCatalogAdminRepository(sql);
    await expectRejected(repository.createVariant(scope, variantInput), "Produto não pertence");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("from public.products");
  });

  test("combinação duplicada de variante é rejeitada antes do INSERT", async () => {
    const calls: string[] = [];
    const sql: CatalogSqlExecutor = {
      query(statement) {
        calls.push(statement);
        if (statement.includes("from public.products")) return Promise.resolve([{ id: "product-a" }]);
        if (statement.includes("from public.product_variants")) return Promise.resolve([{ id: "variant-existing" }]);
        throw new Error("INSERT não deveria executar");
      },
    };
    const repository = createCatalogAdminRepository(sql);
    await expectRejected(repository.createVariant(scope, variantInput), "Combinação de variante");
    expect(calls).toHaveLength(2);
  });

  test("IDOR por variantId não altera variante fora do productId atual", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql: CatalogSqlExecutor = {
      query(statement, params) {
        calls.push({ sql: statement, params });
        if (statement.includes("from public.products")) return Promise.resolve([{ id: "product-a" }]);
        if (statement.includes("from public.product_variants")) return Promise.resolve([]);
        return Promise.resolve([]);
      },
    };
    const repository = createCatalogAdminRepository(sql);
    const updated = await repository.updateVariant(scope, "variant-from-other-product", variantInput);
    expect(updated).toBeNull();
    const update = calls.find((call) => call.sql.includes("update public.product_variants"));
    expect(update?.sql).toContain("tenant_id=$1 and store_id=$2 and product_id=$3 and id=$4");
    expect(update?.params.slice(0, 4)).toEqual([
      "tenant-a",
      "store-a",
      "product-a",
      "variant-from-other-product",
    ]);
    expect(update?.sql).not.toContain("stock_quantity=$");
  });

  test("parentId de categoria fora da store é rejeitado", async () => {
    const sql: CatalogSqlExecutor = {
      query() {
        return Promise.resolve([]);
      },
    };
    const repository = createCatalogAdminRepository(sql);
    await expectRejected(
      repository.createCategory(scope, {
        name: "Filha",
        slug: "filha",
        description: null,
        parentId: "category-b",
        active: true,
        position: 0,
      }),
      "Categoria não pertence",
    );
  });

  test("IDOR por categoryId de outra store/tenant não atualiza categoria", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql: CatalogSqlExecutor = {
      query(statement, params) {
        calls.push({ sql: statement, params });
        return Promise.resolve([]);
      },
    };
    const repository = createCatalogAdminRepository(sql);
    const updated = await repository.updateCategory(scope, "category-b", {
      name: "Categoria",
      slug: "categoria",
      description: null,
      parentId: null,
      active: true,
      position: 0,
    });
    expect(updated).toBeNull();
    expect(calls[0]?.sql).toContain("where tenant_id=$1 and store_id=$2 and id=$3");
    expect(calls[0]?.params.slice(0, 3)).toEqual(["tenant-a", "store-a", "category-b"]);
  });

  test("banner de outra store é rejeitado antes do SQL", async () => {
    const sql: CatalogSqlExecutor = {
      query() {
        throw new Error("SQL não deveria executar");
      },
    };
    const repository = createCatalogAdminRepository(sql);
    await expectRejected(
      repository.createBanner(
        scope,
        {
          title: null,
          altText: null,
          imageObjectKey: "tenants/t1/stores/s2/banner/x.png",
          href: null,
          active: true,
          position: 0,
        },
      ),
      "fora da store",
    );
  });
});
