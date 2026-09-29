import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createInventoryRepository } from "../../packages/inventory/src/index.ts";
import { createOrderRepository } from "../../packages/orders/src/index.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const BASE = "e1000000-0000-4000-8000-000000000001";
const VAR_PRODUCT = "e1000000-0000-4000-8000-000000000002";
const VARIANT = "e2000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.products
      (id,tenant_id,store_id,slug,name,sku,price_cents,active,track_inventory,stock_quantity)
    values
      ('${BASE}','${ids.tenantA}','${ids.storeA}','base','Base','BASE',1299,true,true,5),
      ('${VAR_PRODUCT}','${ids.tenantA}','${ids.storeA}','variavel','Variável','VAR',999,true,true,0);
    insert into public.product_variants
      (id,tenant_id,store_id,product_id,name,sku,price_cents,active,stock_quantity)
    values
      ('${VARIANT}','${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','P','VAR-P',1399,true,4);
    insert into public.stock_movements
      (tenant_id,store_id,product_id,variant_id,delta,reason,movement_type)
    values
      ('${ids.tenantA}','${ids.storeA}','${BASE}',null,5,'Saldo inicial','initial'),
      ('${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','${VARIANT}',4,'Saldo inicial','initial');
  `);
});

afterAll(async () => {
  await h.db.close();
});

describe("orders + inventory", () => {
  test("cria pedido com snapshots e preço exato da variante", async () => {
    const repo = createOrderRepository(h.db);
    const order = await repo.createFromCart(
      { tenantId: ids.tenantA, storeId: ids.storeA },
      {
        idempotencyKey: "checkout-snapshot",
        origin: "whatsapp",
        customerName: "Cliente",
        customerPhone: "5562999999999",
        notes: null,
        shippingCents: 0,
        items: [
          { productId: BASE, variantId: null, quantity: 1 },
          { productId: VAR_PRODUCT, variantId: VARIANT, quantity: 2 },
        ],
      },
    );
    expect(order.subtotalCents).toBe(4097);
    expect(order.totalCents).toBe(4097);
    expect(order.items.find((item) => item.variantId === VARIANT)?.unitCents).toBe(1399);
    expect(order.items.find((item) => item.variantId === VARIANT)?.variantName).toBe("P");
  });

  test("idempotência não duplica pedido", async () => {
    const repo = createOrderRepository(h.db);
    const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
    const input = {
      idempotencyKey: "double-click",
      origin: "whatsapp" as const,
      customerName: null,
      customerPhone: null,
      notes: null,
      shippingCents: 0,
      items: [{ productId: BASE, variantId: null, quantity: 1 }],
    };
    const first = await repo.createFromCart(scope, input);
    const second = await repo.createFromCart(scope, input);
    expect(second.id).toBe(first.id);
    const count = await h.db.query(
      "select count(*)::integer as n from public.orders where tenant_id=$1 and store_id=$2 and idempotency_key=$3",
      [ids.tenantA, ids.storeA, "double-click"],
    );
    expect(Number(count[0]?.["n"])).toBe(1);
  });

  test("confirmar desconta uma vez e cancelar repõe uma vez", async () => {
    const orders = createOrderRepository(h.db);
    const inventory = createInventoryRepository(h.db);
    const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
    const order = await orders.createFromCart(scope, {
      idempotencyKey: "stock-cycle",
      origin: "manual",
      customerName: null,
      customerPhone: null,
      notes: null,
      shippingCents: 0,
      items: [{ productId: VAR_PRODUCT, variantId: VARIANT, quantity: 2 }],
    });

    await orders.confirm(scope, order.id);
    await orders.confirm(scope, order.id);
    let rows = await inventory.list(scope);
    expect(rows.find((row) => row.variantId === VARIANT)?.currentQuantity).toBe(2);

    await orders.cancel(scope, order.id);
    await orders.cancel(scope, order.id);
    rows = await inventory.list(scope);
    expect(rows.find((row) => row.variantId === VARIANT)?.currentQuantity).toBe(4);
  });

  test("produto de outra loja não entra no pedido", async () => {
    const repo = createOrderRepository(h.db);
    let rejected = false;
    try {
      await repo.createFromCart(
        { tenantId: ids.tenantB, storeId: ids.storeB },
        {
          idempotencyKey: "cross-store",
          origin: "manual",
          customerName: null,
          customerPhone: null,
          notes: null,
          shippingCents: 0,
          items: [{ productId: BASE, variantId: null, quantity: 1 }],
        },
      );
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });
});
