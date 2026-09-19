import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { PostgresMerchantOperationsRepository } from "../../packages/merchant-ops/src/index.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const SIMPLE = "f1000000-0000-4000-8000-000000000001";
const VAR_PRODUCT = "f1000000-0000-4000-8000-000000000002";
const VARIANT = "f2000000-0000-4000-8000-000000000001";
const OTHER_PRODUCT = "f1000000-0000-4000-8000-000000000003";
const scopeA = { tenantId: ids.tenantA, storeId: ids.storeA };

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.products
      (id,tenant_id,store_id,slug,name,sku,price_cents,active,track_inventory,stock_quantity)
    values
      ('${SIMPLE}','${ids.tenantA}','${ids.storeA}','insumo-a','Insumo A','INS-A',1000,true,true,2),
      ('${VAR_PRODUCT}','${ids.tenantA}','${ids.storeA}','variavel-compra','Variável Compra','VAR-C',2000,true,true,0),
      ('${OTHER_PRODUCT}','${ids.tenantB}','${ids.storeB}','outro','Outro','OUTRO',1000,true,true,1);
    insert into public.product_variants
      (id,tenant_id,store_id,product_id,name,sku,price_cents,active,stock_quantity)
    values
      ('${VARIANT}','${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','Grande','VAR-G',2500,true,3);
    insert into public.stock_movements
      (tenant_id,store_id,product_id,variant_id,delta,reason,movement_type)
    values
      ('${ids.tenantA}','${ids.storeA}','${SIMPLE}',null,2,'Inicial','initial'),
      ('${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','${VARIANT}',3,'Inicial','initial');
  `);
});

afterAll(async () => { await h.db.close(); });

describe("merchant operations", () => {
  test("fornecedor fica isolado por tenant/store", async () => {
    const repo = new PostgresMerchantOperationsRepository(h.db);
    const supplier = await repo.createSupplier(scopeA, { name: "Fornecedor A", email: "a@example.test" });
    expect(supplier.status).toBe("active");
    await expect(repo.updateSupplierStatus({ tenantId: ids.tenantB, storeId: ids.storeB }, supplier.id, "inactive")).rejects.toThrow();
    const other = await repo.listSuppliers({ tenantId: ids.tenantB, storeId: ids.storeB }, { page: 1, pageSize: 20 });
    expect(other.items.some((item) => item.id === supplier.id)).toBe(false);
  });

  test("receber compra movimenta produto e variante uma única vez", async () => {
    const repo = new PostgresMerchantOperationsRepository(h.db);
    const supplier = await repo.createSupplier(scopeA, { name: "Fornecedor Estoque" });
    const purchase = await repo.createPurchase(scopeA, {
      supplierId: supplier.id,
      purchasedAt: "2026-09-19",
      discountCents: 100,
      surchargeCents: 50,
      notes: "Entrada de teste",
      items: [
        { productId: SIMPLE, variantId: null, quantity: 4, unitCostCents: 700 },
        { productId: VAR_PRODUCT, variantId: VARIANT, quantity: 2, unitCostCents: 1500 },
      ],
    }, ids.users.storeA);
    expect(purchase.totalCents).toBe(5750);

    const first = await repo.receivePurchase(scopeA, purchase.id, ids.users.storeA);
    const second = await repo.receivePurchase(scopeA, purchase.id, ids.users.storeA);
    expect(first.status).toBe("received");
    expect(second.status).toBe("received");

    const balances = await h.db.query(
      `select id,stock_quantity from public.products where id=$1::uuid
       union all select id,stock_quantity from public.product_variants where id=$2::uuid`,
      [SIMPLE, VARIANT],
    );
    expect(Number(balances.find((row) => row["id"] === SIMPLE)?.["stock_quantity"])).toBe(6);
    expect(Number(balances.find((row) => row["id"] === VARIANT)?.["stock_quantity"])).toBe(5);
    const movements = await h.db.query(
      "select count(*)::integer as n from public.stock_movements where reference_type='merchant_purchase' and reference_id=$1::uuid",
      [purchase.id],
    );
    expect(Number(movements[0]?.["n"])).toBe(2);
  });

  test("produto cross-store e base de produto com variantes são rejeitados na compra", async () => {
    const repo = new PostgresMerchantOperationsRepository(h.db);
    await expect(repo.createPurchase(scopeA, {
      supplierId: null,
      purchasedAt: "2026-09-19",
      discountCents: 0,
      surchargeCents: 0,
      items: [{ productId: OTHER_PRODUCT, variantId: null, quantity: 1, unitCostCents: 10 }],
    }, ids.users.storeA)).rejects.toThrow();
    await expect(repo.createPurchase(scopeA, {
      supplierId: null,
      purchasedAt: "2026-09-19",
      discountCents: 0,
      surchargeCents: 0,
      items: [{ productId: VAR_PRODUCT, variantId: null, quantity: 1, unitCostCents: 10 }],
    }, ids.users.storeA)).rejects.toThrow();
  });

  test("financeiro usa centavos, liquida idempotente e não aceita categoria cross-store", async () => {
    const repo = new PostgresMerchantOperationsRepository(h.db);
    const income = await repo.createFinancialCategory(scopeA, { name: "Vendas manuais", direction: "income" });
    const entry = await repo.createFinancialEntry(scopeA, {
      direction: "receivable",
      categoryId: income.id,
      description: "Receita manual",
      amountCents: 12345,
      dueAt: "2026-09-20",
      competenceDate: "2026-09-19",
    }, ids.users.storeA);
    expect(entry.amountCents).toBe(12345);
    const first = await repo.settleFinancialEntry(scopeA, entry.id, "2026-09-19T12:00:00Z");
    const second = await repo.settleFinancialEntry(scopeA, entry.id, "2026-09-20T12:00:00Z");
    expect(first.settledAt).toBe(second.settledAt);
    const summary = await repo.summarizeFinance(scopeA, "2026-09-01", "2026-09-30");
    expect(summary.receivedCents).toBeGreaterThanOrEqual(12345);

    const otherCategory = await repo.createFinancialCategory(
      { tenantId: ids.tenantB, storeId: ids.storeB },
      { name: "Outro tenant", direction: "income" },
    );
    await expect(repo.createFinancialEntry(scopeA, {
      direction: "receivable",
      categoryId: otherCategory.id,
      description: "Cross store",
      amountCents: 100,
      dueAt: "2026-09-20",
      competenceDate: "2026-09-19",
    }, ids.users.storeA)).rejects.toThrow();
  });

  test("tarefa só aceita responsável membro da mesma loja", async () => {
    const repo = new PostgresMerchantOperationsRepository(h.db);
    const task = await repo.createTask(scopeA, { title: "Conferir estoque", priority: "high", assigneeUserId: ids.users.storeA }, ids.users.storeA);
    const done = await repo.completeTask(scopeA, task.id);
    expect(done.status).toBe("done");
    await expect(repo.createTask(scopeA, { title: "Responsável inválido", priority: "normal", assigneeUserId: ids.users.storeB }, ids.users.storeA)).rejects.toThrow();
  });

  test("authenticated direto não lê tabelas Merchant OS sem policy", async () => {
    await h.asUser(ids.users.storeA, "authenticated", async () => {
      const rows = await h.db.query("select id from public.merchant_suppliers");
      expect(rows).toHaveLength(0);
    });
  });
});
