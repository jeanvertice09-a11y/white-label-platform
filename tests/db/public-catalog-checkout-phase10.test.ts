import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createOrderRepository } from "../../packages/orders/src/index.ts";
import type { CreateOrderFromCartInput } from "../../packages/orders/src/index.ts";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const storeA = { tenantId: ids.tenantA, storeId: ids.storeA };
const storeB = { tenantId: ids.tenantB, storeId: ids.storeB };

const ACTIVE_CATEGORY = "fa100000-0000-4000-8000-000000000001";
const INACTIVE_CATEGORY = "fa100000-0000-4000-8000-000000000002";
const SIMPLE = "fa200000-0000-4000-8000-000000000001";
const VAR_PRODUCT = "fa200000-0000-4000-8000-000000000002";
const HIDDEN_CATEGORY_PRODUCT = "fa200000-0000-4000-8000-000000000003";
const HIDDEN_VARIANTS_PRODUCT = "fa200000-0000-4000-8000-000000000004";
const OTHER_PRODUCT = "fb200000-0000-4000-8000-000000000001";
const VARIANT = "fa300000-0000-4000-8000-000000000001";
const OTHER_VARIANT = "fb300000-0000-4000-8000-000000000001";
const INACTIVE_VARIANT = "fa300000-0000-4000-8000-000000000002";

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.categories
      (id,tenant_id,store_id,name,slug,active,position)
    values
      ('${ACTIVE_CATEGORY}','${ids.tenantA}','${ids.storeA}','Ativa','fase10-ativa',true,1),
      ('${INACTIVE_CATEGORY}','${ids.tenantA}','${ids.storeA}','Oculta','fase10-oculta',false,2);

    insert into public.products
      (id,tenant_id,store_id,category_id,slug,name,sku,price_cents,active,track_inventory,stock_quantity)
    values
      ('${SIMPLE}','${ids.tenantA}','${ids.storeA}','${ACTIVE_CATEGORY}','fase10-simple','Simples','F10-S',1299,true,true,5),
      ('${VAR_PRODUCT}','${ids.tenantA}','${ids.storeA}','${ACTIVE_CATEGORY}','fase10-var','Variável','F10-V',900,true,true,0),
      ('${HIDDEN_CATEGORY_PRODUCT}','${ids.tenantA}','${ids.storeA}','${INACTIVE_CATEGORY}','fase10-hidden-cat','Categoria oculta','F10-HC',500,true,false,0),
      ('${HIDDEN_VARIANTS_PRODUCT}','${ids.tenantA}','${ids.storeA}','${ACTIVE_CATEGORY}','fase10-hidden-var','Variantes ocultas','F10-HV',600,true,false,0),
      ('${OTHER_PRODUCT}','${ids.tenantB}','${ids.storeB}',null,'fase10-other','Outra loja','F10-O',9999,true,false,0);

    insert into public.product_variants
      (id,tenant_id,store_id,product_id,name,sku,attributes,price_cents,active,stock_quantity)
    values
      ('${VARIANT}','${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','Preto / M','F10-V-M','{"cor":"Preto","tamanho":"M"}',1799,true,3),
      ('${INACTIVE_VARIANT}','${ids.tenantA}','${ids.storeA}','${HIDDEN_VARIANTS_PRODUCT}','Oculta','F10-HV-O','{"cor":"Oculta"}',699,false,0),
      ('${OTHER_VARIANT}','${ids.tenantB}','${ids.storeB}','${OTHER_PRODUCT}','Outra','F10-O-V','{"cor":"Outra"}',10999,true,2);

    insert into public.stock_movements
      (tenant_id,store_id,product_id,variant_id,delta,reason,movement_type)
    values
      ('${ids.tenantA}','${ids.storeA}','${SIMPLE}',null,5,'Saldo inicial F10','initial'),
      ('${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','${VARIANT}',3,'Saldo inicial F10','initial');
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
    origin: "whatsapp",
    customerName: "Cliente Fase 10",
    customerPhone: "62999999999",
    notes: null,
    shippingCents: 0,
    items: [{ productId, variantId, quantity }],
  };
}

describe("fase 10 public catalog checkout", () => {
  test("produto simples cria pedido real com preço e total do servidor", async () => {
    const orders = createOrderRepository(h.db);
    const manipulated = {
      ...input("f10-simple", SIMPLE, null, 2),
      tenantId: ids.tenantB,
      storeId: ids.storeB,
      priceCents: 1,
      subtotalCents: 1,
      totalCents: 1,
      items: [{ productId: SIMPLE, variantId: null, quantity: 2, priceCents: 1 }],
    };
    const order = await orders.createFromCart(storeA, manipulated);
    expect(order.tenantId).toBe(ids.tenantA);
    expect(order.storeId).toBe(ids.storeA);
    expect(order.status).toBe("pending");
    expect(order.paymentStatus).toBe("pending");
    expect(order.subtotalCents).toBe(2598);
    expect(order.totalCents).toBe(2598);
    expect(order.items[0]?.unitCents).toBe(1299);
    expect(order.items[0]?.productName).toBe("Simples");
  });

  test("variante real usa preço exato e snapshot da variante", async () => {
    const orders = createOrderRepository(h.db);
    const order = await orders.createFromCart(
      storeA,
      input("f10-variant", VAR_PRODUCT, VARIANT, 2),
    );
    expect(order.subtotalCents).toBe(3598);
    expect(order.items[0]?.variantId).toBe(VARIANT);
    expect(order.items[0]?.variantName).toBe("Preto / M");
    expect(order.items[0]?.skuSnapshot).toBe("F10-V-M");
    expect(order.items[0]?.unitCents).toBe(1799);
  });

  test("produto de categoria não pública e produto com variantes ocultas são rejeitados", async () => {
    const orders = createOrderRepository(h.db);
    await expectReject(
      orders.createFromCart(storeA, input("f10-hidden-cat", HIDDEN_CATEGORY_PRODUCT, null)),
      "categoria inativa",
    );
    await expectReject(
      orders.createFromCart(storeA, input("f10-hidden-var", HIDDEN_VARIANTS_PRODUCT, null)),
      "variante oculta não vira produto simples",
    );
  });

  test("cross-store, cross-tenant e variante de outro produto são rejeitados", async () => {
    const orders = createOrderRepository(h.db);
    await expectReject(
      orders.createFromCart(storeA, input("f10-cross-store", OTHER_PRODUCT, null)),
      "produto da loja B",
    );
    await expectReject(
      orders.createFromCart(storeA, input("f10-wrong-variant", VAR_PRODUCT, OTHER_VARIANT)),
      "variante da loja B",
    );
    await expectReject(
      orders.createFromCart(storeB, input("f10-cross-tenant", SIMPLE, null)),
      "produto do tenant A no tenant B",
    );
  });

  test("retry com a mesma chave não duplica order nem order_items", async () => {
    const orders = createOrderRepository(h.db);
    const first = await orders.createFromCart(storeA, input("f10-idempotent", SIMPLE, null));
    const second = await orders.createFromCart(storeA, input("f10-idempotent", SIMPLE, null));
    expect(second.id).toBe(first.id);
    const rows = await h.db.query(
      `select count(distinct o.id)::integer orders_count,
        count(oi.id)::integer items_count
       from public.orders o
       join public.order_items oi on oi.tenant_id=o.tenant_id
        and oi.store_id=o.store_id and oi.order_id=o.id
       where o.tenant_id=$1 and o.store_id=$2 and o.idempotency_key=$3`,
      [ids.tenantA, ids.storeA, "f10-idempotent"],
    );
    expect(Number(rows[0]?.["orders_count"])).toBe(1);
    expect(Number(rows[0]?.["items_count"])).toBe(1);
  });

  test("pedido pending aparece só para a store correta e não baixa estoque", async () => {
    const orders = createOrderRepository(h.db);
    const before = await h.db.query(
      `select count(*)::integer n from public.stock_movements
       where tenant_id=$1 and store_id=$2 and product_id=$3`,
      [ids.tenantA, ids.storeA, SIMPLE],
    );
    const order = await orders.createFromCart(storeA, input("f10-visible", SIMPLE, null));
    const after = await h.db.query(
      `select count(*)::integer n from public.stock_movements
       where tenant_id=$1 and store_id=$2 and product_id=$3`,
      [ids.tenantA, ids.storeA, SIMPLE],
    );
    expect(Number(after[0]?.["n"])).toBe(Number(before[0]?.["n"]));
    expect((await orders.getById(storeA, order.id))?.id).toBe(order.id);
    expect(await orders.getById(storeB, order.id)).toBeNull();
    const pageA = await orders.listPage(storeA, { page: 1, pageSize: 100 });
    const pageB = await orders.listPage(storeB, { page: 1, pageSize: 100 });
    expect(pageA.items.some((item) => item.id === order.id)).toBe(true);
    expect(pageB.items.some((item) => item.id === order.id)).toBe(false);
  });
});
