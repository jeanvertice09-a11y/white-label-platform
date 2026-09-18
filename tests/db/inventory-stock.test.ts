import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createInventoryRepository } from "../../packages/inventory/src/index.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const SIMPLE = "f1000000-0000-4000-8000-000000000001";
const VAR_PRODUCT = "f1000000-0000-4000-8000-000000000002";
const OTHER_PRODUCT = "f1000000-0000-4000-8000-000000000003";
const STORE_B_PRODUCT = "f1000000-0000-4000-8000-000000000004";
const VAR_A = "f2000000-0000-4000-8000-000000000001";
const VAR_B = "f2000000-0000-4000-8000-000000000002";
const OTHER_VARIANT = "f2000000-0000-4000-8000-000000000003";
const ACTOR = ids.users.storeA;

function op(id: string, productId = SIMPLE) {
  return {
    operationId: id,
    productId,
    variantId: null,
    kind: "entry" as const,
    quantity: 1,
    reason: "Teste",
    createdBy: ACTOR,
  };
}

async function resetStock(): Promise<void> {
  await h.db.execScript(`
    delete from public.stock_movements where product_id in ('${SIMPLE}','${VAR_PRODUCT}','${OTHER_PRODUCT}','${STORE_B_PRODUCT}');
    update public.products set stock_quantity=case id
      when '${SIMPLE}' then 10 else 0 end
      where id in ('${SIMPLE}','${VAR_PRODUCT}','${OTHER_PRODUCT}','${STORE_B_PRODUCT}');
    update public.product_variants set stock_quantity=case id
      when '${VAR_A}' then 5 when '${VAR_B}' then 8 else 2 end
      where id in ('${VAR_A}','${VAR_B}','${OTHER_VARIANT}');
    insert into public.stock_movements
      (tenant_id,store_id,product_id,variant_id,delta,reason,movement_type)
    values
      ('${ids.tenantA}','${ids.storeA}','${SIMPLE}',null,10,'Saldo inicial','initial'),
      ('${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','${VAR_A}',5,'Saldo inicial A','initial'),
      ('${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','${VAR_B}',8,'Saldo inicial B','initial'),
      ('${ids.tenantA}','${ids.storeA}','${OTHER_PRODUCT}','${OTHER_VARIANT}',2,'Saldo inicial outro','initial');
  `);
}

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.products
      (id,tenant_id,store_id,slug,name,sku,price_cents,active,track_inventory,stock_quantity)
    values
      ('${SIMPLE}','${ids.tenantA}','${ids.storeA}','estoque-simples','Estoque Simples','EST-S',1000,true,true,10),
      ('${VAR_PRODUCT}','${ids.tenantA}','${ids.storeA}','estoque-variantes','Estoque Variantes','EST-V',1000,true,true,0),
      ('${OTHER_PRODUCT}','${ids.tenantA}','${ids.storeA}','estoque-outro','Estoque Outro','EST-O',1000,true,true,0),
      ('${STORE_B_PRODUCT}','${ids.tenantB}','${ids.storeB}','estoque-b','Estoque B','EST-B',1000,true,true,0);
    insert into public.product_variants
      (id,tenant_id,store_id,product_id,name,sku,attributes,price_cents,active,stock_quantity)
    values
      ('${VAR_A}','${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','P / Preto','EST-P','{"tamanho":"P","cor":"Preto"}',1100,true,5),
      ('${VAR_B}','${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','M / Preto','EST-M','{"tamanho":"M","cor":"Preto"}',1200,true,8),
      ('${OTHER_VARIANT}','${ids.tenantA}','${ids.storeA}','${OTHER_PRODUCT}','Única','EST-O-U','{"tipo":"unica"}',1300,true,2);
  `);
  await resetStock();
});

beforeEach(resetStock);

afterAll(async () => {
  await h.db.close();
});

describe("inventory stock movements", () => {
  test("saldo de produto simples vem do ledger", async () => {
    const rows = await createInventoryRepository(h.db).list({ tenantId: ids.tenantA, storeId: ids.storeA });
    expect(rows.find((row) => row.productId === SIMPLE)?.currentQuantity).toBe(10);
  });

  test("entrada, saída e ajuste de produto simples", async () => {
    const repo = createInventoryRepository(h.db);
    const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
    expect((await repo.move(scope, { ...op("10000000-0000-4000-8000-000000000001"), quantity: 4 })).currentQuantity).toBe(14);
    expect((await repo.move(scope, { ...op("10000000-0000-4000-8000-000000000002"), kind: "exit", quantity: 3 })).currentQuantity).toBe(11);
    expect((await repo.move(scope, { ...op("10000000-0000-4000-8000-000000000003"), kind: "set", quantity: 7 })).currentQuantity).toBe(7);
  });

  test("variantes mantêm saldos independentes", async () => {
    const repo = createInventoryRepository(h.db);
    const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
    await repo.move(scope, {
      ...op("20000000-0000-4000-8000-000000000001", VAR_PRODUCT),
      variantId: VAR_A,
      quantity: 3,
    });
    await repo.move(scope, {
      ...op("20000000-0000-4000-8000-000000000002", VAR_PRODUCT),
      variantId: VAR_B,
      kind: "exit",
      quantity: 2,
    });
    const rows = await repo.list(scope);
    expect(rows.find((row) => row.variantId === VAR_A)?.currentQuantity).toBe(8);
    expect(rows.find((row) => row.variantId === VAR_B)?.currentQuantity).toBe(6);
  });

  test("ajuste por variante define o saldo final", async () => {
    const result = await createInventoryRepository(h.db).move(
      { tenantId: ids.tenantA, storeId: ids.storeA },
      {
        ...op("20000000-0000-4000-8000-000000000003", VAR_PRODUCT),
        variantId: VAR_A,
        kind: "set",
        quantity: 1,
      },
    );
    expect(result.currentQuantity).toBe(1);
    expect(result.delta).toBe(-4);
  });

  test("quantidade inválida é rejeitada", async () => {
    await expect(createInventoryRepository(h.db).move(
      { tenantId: ids.tenantA, storeId: ids.storeA },
      { ...op("30000000-0000-4000-8000-000000000001"), quantity: 0 },
    )).rejects.toThrow("Quantidade inválida");
  });

  test("produto inexistente, IDOR e variante de outro produto são rejeitados", async () => {
    const repo = createInventoryRepository(h.db);
    await expect(repo.move(
      { tenantId: ids.tenantA, storeId: ids.storeA },
      { ...op("30000000-0000-4000-8000-000000000002", "ffffffff-ffff-4fff-8fff-ffffffffffff") },
    )).rejects.toThrow("não encontrado");
    await expect(repo.move(
      { tenantId: ids.tenantA, storeId: ids.storeA },
      { ...op("30000000-0000-4000-8000-000000000003", VAR_PRODUCT), variantId: OTHER_VARIANT },
    )).rejects.toThrow("não encontrado");
    await expect(repo.move(
      { tenantId: ids.tenantB, storeId: ids.storeB },
      { ...op("30000000-0000-4000-8000-000000000004", SIMPLE) },
    )).rejects.toThrow("não encontrado");
  });

  test("histórico é real, filtrável e isolado por store", async () => {
    const repo = createInventoryRepository(h.db);
    const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
    await repo.move(scope, { ...op("40000000-0000-4000-8000-000000000001"), quantity: 2, reason: "Reposição balcão" });
    const page = await repo.history(scope, { page: 1, pageSize: 10, search: "balcão", movementType: "purchase" });
    expect(page.total).toBe(1);
    expect(page.items[0]?.createdBy).toBe(ACTOR);
    const other = await repo.history({ tenantId: ids.tenantB, storeId: ids.storeB }, { page: 1, pageSize: 10 });
    expect(other.items.some((row) => row.productId === SIMPLE)).toBe(false);
  });

  test("retry com mesmo operationId não duplica movimento", async () => {
    const repo = createInventoryRepository(h.db);
    const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
    const input = { ...op("50000000-0000-4000-8000-000000000001"), quantity: 3 };
    const first = await repo.move(scope, input);
    const second = await repo.move(scope, input);
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.currentQuantity).toBe(13);
    const count = await h.db.query(
      "select count(*)::int n from public.stock_movements where reference_type='inventory_operation' and reference_id=$1::uuid",
      [input.operationId],
    );
    expect(Number(count[0]?.["n"])).toBe(1);
  });

  test("duas saídas concorrentes não deixam saldo negativo", async () => {
    await h.db.execScript(`
      delete from public.stock_movements where product_id='${SIMPLE}';
      update public.products set stock_quantity=1 where id='${SIMPLE}';
      insert into public.stock_movements (tenant_id,store_id,product_id,delta,reason,movement_type)
      values ('${ids.tenantA}','${ids.storeA}','${SIMPLE}',1,'Saldo concorrência','initial');
    `);
    const repo = createInventoryRepository(h.db);
    const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
    const results = await Promise.allSettled([
      repo.move(scope, { ...op("60000000-0000-4000-8000-000000000001"), kind: "exit", quantity: 1 }),
      repo.move(scope, { ...op("60000000-0000-4000-8000-000000000002"), kind: "exit", quantity: 1 }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rows = await repo.list(scope);
    expect(rows.find((row) => row.productId === SIMPLE)?.currentQuantity).toBe(0);
  });

  test("ledger e saldo materializado permanecem consistentes", async () => {
    const repo = createInventoryRepository(h.db);
    const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
    await repo.move(scope, { ...op("70000000-0000-4000-8000-000000000001"), kind: "exit", quantity: 4 });
    const rows = await h.db.query(
      `select p.stock_quantity,(select coalesce(sum(sm.delta),0)::int from public.stock_movements sm
        where sm.tenant_id=p.tenant_id and sm.store_id=p.store_id and sm.product_id=p.id and sm.variant_id is null) ledger_quantity
       from public.products p where p.id=$1::uuid`,
      [SIMPLE],
    );
    expect(Number(rows[0]?.["stock_quantity"])).toBe(Number(rows[0]?.["ledger_quantity"]));
  });
});
