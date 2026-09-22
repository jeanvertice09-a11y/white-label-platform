import { describe, expect, test } from "bun:test";
import { createCatalogReadRepository } from "../../packages/catalog/src/postgres-read.ts";
import type { CatalogSqlExecutor } from "../../packages/catalog/src/repository.ts";

describe("catalog postgres repository scope", () => {
  test("leituras sempre carregam tenantId e storeId como primeiros parâmetros", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const sql: CatalogSqlExecutor = { query(statement, params) { calls.push({ sql: statement, params }); return Promise.resolve([]); } };
    const repository = createCatalogReadRepository(sql); const scope = { tenantId: "tenant-a", storeId: "store-a" };
    await repository.getStore(scope); await repository.getSettings(scope); await repository.listCategories(scope, true); await repository.listBanners(scope, true); await repository.listProducts({ ...scope, page: 1, pageSize: 20 }, true);
    expect(calls.length).toBe(5);
    for (const call of calls) { expect(call.params[0]).toBe("tenant-a"); expect(call.params[1]).toBe("store-a"); expect(call.sql).toContain("tenant_id"); expect(call.sql).toContain("store_id"); }
  });

  test("catálogo público adiciona filtros de atividade", async () => {
    const statements: string[] = []; const sql: CatalogSqlExecutor = { query(statement) { statements.push(statement); return Promise.resolve([]); } };
    const repository = createCatalogReadRepository(sql); const scope = { tenantId: "t", storeId: "s" };
    await repository.listCategories(scope, true); await repository.listBanners(scope, true); await repository.listProducts({ ...scope, page: 1, pageSize: 20 }, true);
    const all = statements.join("\n"); expect(all).toContain("p.active=true"); expect(all).toContain("vv.active=true");
  });

  test("produto com variantes somente inativas não é tratado como produto simples público", async () => {
    const statements: string[] = []; const sql: CatalogSqlExecutor = { query(statement) { statements.push(statement); return Promise.resolve([]); } };
    const repository = createCatalogReadRepository(sql); await repository.listProducts({ tenantId: "t", storeId: "s", page: 1, pageSize: 20 }, true);
    const statement = statements[0] ?? ""; expect(statement).toContain("not exists (select 1 from public.product_variants va"); expect(statement).toContain("or exists (select 1 from public.product_variants vv"); expect(statement).toContain("vv.active=true");
  });

  test("busca cobre nome, SKU e categoria sem sair do tenant/store", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = []; const sql: CatalogSqlExecutor = { query(statement, params) { calls.push({ sql: statement, params }); return Promise.resolve([]); } };
    const repository = createCatalogReadRepository(sql); await repository.listProducts({ tenantId: "tenant-a", storeId: "store-a", page: 1, pageSize: 20, search: "camisa" }, true);
    const call = calls[0]; expect(call?.params.slice(0, 3)).toEqual(["tenant-a", "store-a", "%camisa%"]); expect(call?.sql).toContain("p.name ilike $3"); expect(call?.sql).toContain("coalesce(p.sku,'') ilike $3"); expect(call?.sql).toContain("sc.tenant_id=p.tenant_id"); expect(call?.sql).toContain("sc.store_id=p.store_id"); expect(call?.sql).toContain("sc.name ilike $3");
  });

  test("filtro sem estoque é aplicado somente quando solicitado pelo servidor", async () => {
    const statements: string[] = []; const sql: CatalogSqlExecutor = { query(statement) { statements.push(statement); return Promise.resolve([]); } };
    const repository = createCatalogReadRepository(sql); await repository.listProducts({ tenantId: "t", storeId: "s", page: 1, pageSize: 20, inStockOnly: true }, true);
    const statement = statements[0] ?? ""; expect(statement).toContain("p.track_inventory=false"); expect(statement).toContain("p.stock_quantity>0"); expect(statement).toContain("sv.active=true and sv.stock_quantity>0");
  });
});
