import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createOrderRepository,
  getMerchantDashboardMetrics,
} from "../../packages/orders/src/index.ts";
import { createCustomerRepository } from "../../packages/customers/src/index.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const PRODUCT = "fa000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.products
      (id,tenant_id,store_id,slug,name,price_cents,active,track_inventory,stock_quantity)
    values ('${PRODUCT}','${ids.tenantA}','${ids.storeA}',
      'dashboard-prod','Dashboard Produto',2000,true,true,3);
    insert into public.stock_movements
      (tenant_id,store_id,product_id,delta,reason,movement_type)
    values ('${ids.tenantA}','${ids.storeA}','${PRODUCT}',3,'Inicial','initial');
  `);
});

afterAll(async () => {
  await h.db.close();
});

describe("merchant dashboard real metrics", () => {
  test("faturamento e ticket usam pedidos concluídos válidos", async () => {
    const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
    const customers = createCustomerRepository(h.db);
    await customers.create(scope, {
      name: "Dashboard Cliente",
      phone: "62999998888",
      email: null,
      document: null,
      birthDate: null,
      notes: null,
    });
    const orders = createOrderRepository(h.db);
    const first = await orders.createFromCart(scope, {
      idempotencyKey: "dash-completed",
      origin: "manual",
      customerName: null,
      customerPhone: null,
      notes: null,
      shippingCents: 0,
      items: [{ productId: PRODUCT, variantId: null, quantity: 2 }],
    });
    await h.db.query(
      `update public.orders set status='completed',payment_status='paid',
       completed_at=now() where tenant_id=$1 and store_id=$2 and id=$3`,
      [ids.tenantA, ids.storeA, first.id],
    );
    await orders.createFromCart(scope, {
      idempotencyKey: "dash-pending",
      origin: "manual",
      customerName: null,
      customerPhone: null,
      notes: null,
      shippingCents: 0,
      items: [{ productId: PRODUCT, variantId: null, quantity: 1 }],
    });

    const metrics = await getMerchantDashboardMetrics(h.db, scope);
    expect(metrics.ordersToday).toBe(2);
    expect(metrics.pendingOrders).toBe(1);
    expect(metrics.revenuePeriodCents).toBe(4000);
    expect(metrics.validOrdersPeriod).toBe(1);
    expect(metrics.averageTicketCents).toBe(4000);
    expect(metrics.customers).toBe(1);
    expect(metrics.lowStockProducts).toBe(1);
  });
});
