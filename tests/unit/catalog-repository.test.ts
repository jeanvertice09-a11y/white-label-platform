import { describe, expect, test } from "bun:test";
import { createCatalogReadRepository } from "../../packages/catalog/src/postgres-read.ts";
import type { CatalogSqlExecutor } from "../../packages/catalog/src/repository.ts";

describe("catalog postgres repository scope", () => {
  test("leituras sempre carregam tenantId e storeId como primeiros parâmetros", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql: CatalogSqlExecutor = {
      query(statement, params) {
        calls.push({ sql: statement, params });
        return Promise.resolve([]);
      },
    };
    const repository = createCatalogReadRepository(sql);
    const scope = { tenantId: "tenant-a", storeId: "store-a" };

    await repository.getStore(scope);
    await repository.getSettings(scope);
    await repository.listCategories(scope, true);
    await repository.listBanners(scope, true);
    await repository.listProducts({ ...scope, page: 1, pageSize: 20 }, true);

    expect(calls.length).toBe(5);
    for (const call of calls) {
      expect(call.params[0]).toBe("tenant-a");
      expect(call.params[1]).toBe("store-a");
      expect(call.sql).toContain("tenant_id");
      expect(call.sql).toContain("store_id");
    }
  });

  test("catálogo público adiciona filtros de atividade", async () => {
    const statements: string[] = [];
    const sql: CatalogSqlExecutor = {
      query(statement) {
        statements.push(statement);
        return Promise.resolve([]);
      },
    };
    const repository = createCatalogReadRepository(sql);
    const scope = { tenantId: "t", storeId: "s" };

    await repository.listCategories(scope, true);
    await repository.listBanners(scope, true);
    await repository.listProducts({ ...scope, page: 1, pageSize: 20 }, true);

    expect(statements.join("\n")).toContain("active=true");
    expect(statements.join("\n")).toContain("p.active=true");
  });
});
