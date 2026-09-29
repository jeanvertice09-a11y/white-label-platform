import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createCatalogReadRepository } from "../../packages/catalog/src/index.ts";
import { createOrderRepository } from "../../packages/orders/src/index.ts";
import type { CreateOrderFromCartInput } from "../../packages/orders/src/index.ts";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
const PARENT = "d1700000-0000-4000-8000-000000000001";
const CHILD = "d1700000-0000-4000-8000-000000000002";
const HIDDEN_PARENT = "d1700000-0000-4000-8000-000000000003";
const HIDDEN_CHILD = "d1700000-0000-4000-8000-000000000004";
const SIMPLE = "d1710000-0000-4000-8000-000000000001";
const SECOND = "d1710000-0000-4000-8000-000000000002";
const HIDDEN = "d1710000-0000-4000-8000-000000000003";
const VAR_PRODUCT = "d1710000-0000-4000-8000-000000000004";
const VARIANT = "d1720000-0000-4000-8000-000000000001";

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.categories (id,tenant_id,store_id,name,slug,parent_id,active,position) values
      ('${PARENT}','${ids.tenantA}','${ids.storeA}','Roupas','f17-roupas',null,true,1),
      ('${CHILD}','${ids.tenantA}','${ids.storeA}','Camisetas','f17-camisetas','${PARENT}',true,2),
      ('${HIDDEN_PARENT}','${ids.tenantA}','${ids.storeA}','Oculta','f17-oculta',null,false,3),
      ('${HIDDEN_CHILD}','${ids.tenantA}','${ids.storeA}','Filha oculta','f17-filha-oculta','${HIDDEN_PARENT}',true,4);
    insert into public.products
      (id,tenant_id,store_id,category_id,slug,name,sku,price_cents,cost_cents,active,track_inventory,stock_quantity,position)
    values
      ('${SIMPLE}','${ids.tenantA}','${ids.storeA}','${CHILD}','f17-camiseta','Camiseta Azul','F17-A',2500,900,true,true,2,1),
      ('${SECOND}','${ids.tenantA}','${ids.storeA}','${PARENT}','f17-calca','Calça','F17-B',5000,1800,true,false,0,2),
      ('${HIDDEN}','${ids.tenantA}','${ids.storeA}','${HIDDEN_CHILD}','f17-hidden','Produto oculto','F17-H',1000,200,true,false,0,3),
      ('${VAR_PRODUCT}','${ids.tenantA}','${ids.storeA}','${CHILD}','f17-var','Tênis','F17-V',1000,300,true,true,0,4);
    insert into public.product_variants
      (id,tenant_id,store_id,product_id,name,sku,attributes,price_cents,cost_cents,active,stock_quantity)
    values ('${VARIANT}','${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','42 Azul','F17-V42','{"tamanho":"42","cor":"Azul"}',7990,3200,true,1);
    insert into public.stock_movements
      (tenant_id,store_id,product_id,variant_id,delta,reason,movement_type)
    values
      ('${ids.tenantA}','${ids.storeA}','${SIMPLE}',null,2,'Saldo F17','initial'),
      ('${ids.tenantA}','${ids.storeA}','${VAR_PRODUCT}','${VARIANT}',1,'Saldo F17 variante','initial');
  `);
});

afterAll(async () => { await h.db.close(); });

function orderInput(key: string, productId: string, variantId: string | null, quantity: number): CreateOrderFromCartInput {
  return {
    idempotencyKey: key,
    origin: "whatsapp",
    customerName: "Cliente Storefront",
    customerPhone: "62988887777",
    notes: null,
    shippingCents: 0,
    items: [{ productId, variantId, quantity }],
  };
}

describe("fase 17 storefront commerce", () => {
  test("busca, paginação e categoria/subcategoria são server-side e scoped", async () => {
    const catalog = createCatalogReadRepository(h.db);
    const search = await catalog.listProducts({ ...scope, page: 1, pageSize: 1, search: "Camiseta", sort: "name" }, true);
    expect(search.total).toBe(2);
    expect(search.items[0]?.id).toBe(SIMPLE);
    const searchSecondPage = await catalog.listProducts({ ...scope, page: 2, pageSize: 1, search: "Camiseta", sort: "name" }, true);
    expect(searchSecondPage.items[0]?.id).toBe(VAR_PRODUCT);
    const parent = await catalog.listProducts({ ...scope, page: 1, pageSize: 10, categoryId: PARENT, sort: "position" }, true);
    expect(parent.items.map((item) => item.id)).toEqual([SIMPLE, SECOND, VAR_PRODUCT]);
    const categories = await catalog.listCategories(scope, true);
    expect(categories.some((item) => item.id === CHILD)).toBe(true);
    expect(categories.some((item) => item.id === HIDDEN_CHILD)).toBe(false);
  });

  test("payload público não expõe custo de produto nem variante", async () => {
    const catalog = createCatalogReadRepository(h.db);
    const page = await catalog.listProducts({ ...scope, page: 1, pageSize: 10, sort: "position" }, true);
    const serialized = JSON.stringify(page);
    expect(serialized.includes("costCents")).toBe(false);
    expect(page.items.some((item) => item.id === HIDDEN)).toBe(false);
  });

  test("checkout revalida estoque simples e de variante sem criar pedido", async () => {
    const orders = createOrderRepository(h.db);
    await expectReject(orders.createFromCart(scope, orderInput("f17-no-stock-simple", SIMPLE, null, 3)), "estoque simples insuficiente");
    await expectReject(orders.createFromCart(scope, orderInput("f17-no-stock-var", VAR_PRODUCT, VARIANT, 2)), "estoque de variante insuficiente");
    const rows = await h.db.query("select count(*)::integer n from public.orders where tenant_id=$1 and store_id=$2 and idempotency_key like 'f17-no-stock-%'", [ids.tenantA, ids.storeA]);
    expect(Number(rows[0]?.["n"])).toBe(0);
  });

  test("pedido pending preserva estoque e retry simultâneo cria uma única ordem", async () => {
    const orders = createOrderRepository(h.db);
    const before = await h.db.query("select count(*)::integer n from public.stock_movements where tenant_id=$1 and store_id=$2 and product_id=$3", [ids.tenantA, ids.storeA, SIMPLE]);
    const payload = orderInput("f17-concurrent-retry", SIMPLE, null, 1);
    const [first, second] = await Promise.all([orders.createFromCart(scope, payload), orders.createFromCart(scope, payload)]);
    expect(second.id).toBe(first.id);
    expect(first.status).toBe("pending");
    const after = await h.db.query("select count(*)::integer n from public.stock_movements where tenant_id=$1 and store_id=$2 and product_id=$3", [ids.tenantA, ids.storeA, SIMPLE]);
    expect(Number(after[0]?.["n"])).toBe(Number(before[0]?.["n"]));
    const count = await h.db.query("select count(*)::integer n from public.orders where tenant_id=$1 and store_id=$2 and idempotency_key=$3", [ids.tenantA, ids.storeA, "f17-concurrent-retry"]);
    expect(Number(count[0]?.["n"])).toBe(1);
  });
});
