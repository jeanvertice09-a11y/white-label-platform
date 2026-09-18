import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createInventoryRepository } from "../../packages/inventory/src/index.ts";
import { createOrderRepository } from "../../packages/orders/src/index.ts";
import type { CreateOrderFromCartInput } from "../../packages/orders/src/index.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
const otherScope = { tenantId: ids.tenantB, storeId: ids.storeB };

const SIMPLE = "f1000000-0000-4000-8000-000000000001";
const VAR_PRODUCT = "f1000000-0000-4000-8000-000000000002";
const VARIANT = "f2000000-0000-4000-8000-000000000001";
const OTHER_VARIANT = "f2000000-0000-4000-8000-000000000002";
const OTHER_PRODUCT = "f1000000-0000-4000-8000-000000000003";
const LAST = "f1000000-0000-4000-8000-000000000004";
const EMPTY = "f1000000-0000-4000-8000-000000000005";

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.products
      (id,tenant_id,store_id,slug,name,sku,price_cents,active,track_inventory,stock_quantity)
    values
      ('${SIMPLE}','${ids.tenantA}','${ids.storeA}','p8-simple','Simples','P8-S',1299,true,true,5),
      ('${VAR_PRODUCT}','${ids.tenantA}','${ids.storeA}','p8-var','Variável','P8-V',999,true,true,0),
      ('${OTHER_PRODUCT}','${ids.tenantA}','${ids.storeA}','p8-other','Outro','P8-O',1599,true,true,0),
      ('${LAST}','${ids.tenantA}','${ids.storeA}','p8-last','Última','P8-L',500,true,true,1),
      ('${EMPTY}','${ids.tenantA}','${ids.storeA}','p8-empty','Sem estoque','P8-E',700,true,true,0);
    insert into public.product_variants
      (id,tenant_id,store_id,product_id,name,sku,price_cents,active,stock_quantity)
    values
      ('${VARIANT}','${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','Azul / P','P8-V-P',1399,true,4),
      ('${OTHER_VARIANT}','${ids.tenantA}','${ids.storeA}','${OTHER_PRODUCT}','Única','P8-O-U',1699,true,3);
    insert into public.stock_movements
      (tenant_id,store_id,product_id,variant_id,delta,reason,movement_type)
    values
      ('${ids.tenantA}','${ids.storeA}','${SIMPLE}',null,5,'Saldo inicial','initial'),
      ('${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','${VARIANT}',4,'Saldo inicial','initial'),
      ('${ids.tenantA}','${ids.storeA}','${OTHER_PRODUCT}','${OTHER_VARIANT}',3,'Saldo inicial','initial'),
      ('${ids.tenantA}','${ids.storeA}','${LAST}',null,1,'Saldo inicial','initial');
  `);
});

afterAll(async () => {
  await h.db.close();
});

function input(
  key: string,
  productId: string,
  variantId: string | null,
  quantity = 1,
): CreateOrderFromCartInput {
  return {
    idempotencyKey: key,
    origin: "manual",
    customerName: "Cliente Fase 08",
    customerPhone: null,
    notes: null,
    shippingCents: 0,
    items: [{ productId, variantId, quantity }],
  };
}

describe("fase 08 orders + inventory", () => {
  test("preço e total vêm do servidor mesmo com campos extras manipulados", async () => {
    const repo = createOrderRepository(h.db);
    const manipulated = {
      ...input("p8-price-tamper", VAR_PRODUCT, VARIANT, 2),
      subtotalCents: 1,
      totalCents: 1,
      items: [{
        productId: VAR_PRODUCT,
        variantId: VARIANT,
        quantity: 2,
        priceCents: 1,
        unitCents: 1,
      }],
    };
    const order = await repo.createFromCart(scope, manipulated);
    expect(order.subtotalCents).toBe(2798);
    expect(order.totalCents).toBe(2798);
    expect(order.items[0]?.unitCents).toBe(1399);
    expect(order.items[0]?.skuSnapshot).toBe("P8-V-P");
  });

  test("produto inexistente e variante inválida são rejeitados", async () => {
    const repo = createOrderRepository(h.db);
    await expect(repo.createFromCart(
      scope,
      input("p8-missing-product", "ffffffff-0000-4000-8000-ffffffffffff", null),
    )).rejects.toThrow();
    await expect(repo.createFromCart(
      scope,
      input("p8-wrong-variant", VAR_PRODUCT, OTHER_VARIANT),
    )).rejects.toThrow();
  });

  test("UUID de pedido não atravessa store/tenant", async () => {
    const repo = createOrderRepository(h.db);
    const order = await repo.createFromCart(
      scope,
      input("p8-idor", SIMPLE, null),
    );
    expect(await repo.getById(otherScope, order.id)).toBeNull();
    expect(await repo.confirm(otherScope, order.id)).toBeNull();
  });

  test("produto simples baixa exatamente uma vez e retry é idempotente", async () => {
    const orders = createOrderRepository(h.db);
    const inventory = createInventoryRepository(h.db);
    const order = await orders.createFromCart(
      scope,
      input("p8-simple-stock", SIMPLE, null, 2),
    );
    await orders.confirm(scope, order.id, ids.users.storeA);
    await orders.confirm(scope, order.id, ids.users.storeA);
    const rows = await inventory.list(scope);
    expect(rows.find((row) => row.productId === SIMPLE)?.currentQuantity).toBe(3);
    const movements = await h.db.query(
      `select count(*)::integer n from public.stock_movements
       where tenant_id=$1 and store_id=$2 and product_id=$3
         and movement_type='sale' and reference_type='order' and reference_id=$4`,
      [ids.tenantA, ids.storeA, SIMPLE, order.id],
    );
    expect(Number(movements[0]?.["n"])).toBe(1);
  });

  test("variante baixa e cancelamento restaura exatamente uma vez", async () => {
    const orders = createOrderRepository(h.db);
    const order = await orders.createFromCart(
      scope,
      input("p8-variant-cycle", VAR_PRODUCT, VARIANT, 2),
    );
    await orders.confirm(scope, order.id, ids.users.storeA);
    await orders.cancel(scope, order.id, ids.users.storeA);
    await orders.cancel(scope, order.id, ids.users.storeA);
    const balance = await h.db.query(
      `select v.stock_quantity::integer materialized,
        coalesce(sum(sm.delta),0)::integer ledger
       from public.product_variants v
       left join public.stock_movements sm
         on sm.tenant_id=v.tenant_id and sm.store_id=v.store_id
        and sm.product_id=v.product_id and sm.variant_id=v.id
       where v.tenant_id=$1 and v.store_id=$2 and v.product_id=$3 and v.id=$4
       group by v.stock_quantity`,
      [ids.tenantA, ids.storeA, VAR_PRODUCT, VARIANT],
    );
    expect(Number(balance[0]?.["materialized"])).toBe(
      Number(balance[0]?.["ledger"]),
    );
    const cancellation = await h.db.query(
      `select count(*)::integer n from public.stock_movements
       where tenant_id=$1 and store_id=$2 and movement_type='cancellation'
         and reference_type='order' and reference_id=$3`,
      [ids.tenantA, ids.storeA, order.id],
    );
    expect(Number(cancellation[0]?.["n"])).toBe(1);
  });

  test("cancelar pending não cria restauração artificial", async () => {
    const orders = createOrderRepository(h.db);
    const order = await orders.createFromCart(
      scope,
      input("p8-cancel-pending", SIMPLE, null),
    );
    await orders.cancel(scope, order.id, ids.users.storeA);
    const movements = await h.db.query(
      `select count(*)::integer n from public.stock_movements
       where tenant_id=$1 and store_id=$2 and reference_type='order'
         and reference_id=$3`,
      [ids.tenantA, ids.storeA, order.id],
    );
    expect(Number(movements[0]?.["n"])).toBe(0);
  });

  test("estoque insuficiente mantém pedido pending e saldo não negativo", async () => {
    const orders = createOrderRepository(h.db);
    const order = await orders.createFromCart(
      scope,
      input("p8-insufficient", EMPTY, null),
    );
    await expect(orders.confirm(scope, order.id)).rejects.toThrow("Estoque insuficiente");
    const loaded = await orders.getById(scope, order.id);
    expect(loaded?.status).toBe("pending");
    const stock = await h.db.query(
      "select stock_quantity::integer q from public.products where id=$1",
      [EMPTY],
    );
    expect(Number(stock[0]?.["q"])).toBe(0);
  });

  test("duas confirmações concorrentes não vendem a última unidade", async () => {
    const orders = createOrderRepository(h.db);
    const first = await orders.createFromCart(
      scope,
      input("p8-last-a", LAST, null),
    );
    const second = await orders.createFromCart(
      scope,
      input("p8-last-b", LAST, null),
    );
    const results = await Promise.allSettled([
      orders.confirm(scope, first.id),
      orders.confirm(scope, second.id),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const stock = await h.db.query(
      "select stock_quantity::integer q from public.products where id=$1",
      [LAST],
    );
    expect(Number(stock[0]?.["q"])).toBe(0);
  });

  test("máquina de status aceita sequência e rejeita salto", async () => {
    const orders = createOrderRepository(h.db);
    const order = await orders.createFromCart(
      scope,
      input("p8-status", SIMPLE, null),
    );
    await expect(
      orders.advance(scope, order.id, "preparing"),
    ).rejects.toThrow("Transição de status inválida");
    await orders.confirm(scope, order.id);
    await orders.advance(scope, order.id, "preparing");
    await orders.advance(scope, order.id, "preparing");
    await orders.advance(scope, order.id, "ready");
    const completed = await orders.advance(scope, order.id, "completed");
    expect(completed?.status).toBe("completed");
    await expect(orders.cancel(scope, order.id)).rejects.toThrow(
      "Transição de status inválida",
    );
  });

  test("auditoria registra criação, status, consumo, cancelamento e restauração", async () => {
    const orders = createOrderRepository(h.db);
    const order = await orders.createFromCart(
      scope,
      input("p8-audit", OTHER_PRODUCT, OTHER_VARIANT),
    );
    await orders.confirm(scope, order.id, ids.users.storeA);
    await orders.cancel(scope, order.id, ids.users.storeA);
    const timeline = await orders.getTimeline(scope, order.id);
    const actions = timeline.map((event) => event.action);
    expect(actions).toContain("order.created");
    expect(actions).toContain("order.status_changed");
    expect(actions).toContain("order.stock_consumed");
    expect(actions).toContain("order.cancelled");
    expect(actions).toContain("order.stock_restored");
  });
});
