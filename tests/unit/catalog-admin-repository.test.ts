import { describe, expect, test } from "bun:test";
import { createCatalogAdminRepository } from "../../packages/catalog/src/postgres-admin.ts";
import type { CatalogSqlExecutor } from "../../packages/catalog/src/repository.ts";

describe("catalog admin repository scope", () => {
  test("update de produto sempre usa tenant/store/id no WHERE", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql: CatalogSqlExecutor = {
      query(statement, params) {
        calls.push({ sql: statement, params });
        return Promise.resolve([]);
      },
    };
    const repository = createCatalogAdminRepository(sql);
    await repository.updateProduct(
      { tenantId: "tenant-a", storeId: "store-a" },
      "product-a",
      {
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
      },
    );
    expect(calls[0]?.params.slice(0, 3)).toEqual(["tenant-a", "store-a", "product-a"]);
    expect(calls[0]?.sql).toContain("where tenant_id=$1 and store_id=$2 and id=$3");
  });

  test("banner de outra store é rejeitado antes do SQL", async () => {
    const sql: CatalogSqlExecutor = {
      query() {
        throw new Error("SQL não deveria executar");
      },
    };
    const repository = createCatalogAdminRepository(sql);
    await expect(
      repository.createBanner(
        { tenantId: "t1", storeId: "s1" },
        {
          title: null,
          altText: null,
          imageObjectKey: "tenants/t1/stores/s2/banner/x.png",
          href: null,
          active: true,
          position: 0,
        },
      ),
    ).rejects.toThrow();
  });
});
