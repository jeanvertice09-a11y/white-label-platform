import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createCustomerRepository } from "../../packages/customers/src/index.ts";
import { createCouponRepository } from "../../packages/marketing/src/index.ts";
import { createOrderRepository } from "../../packages/orders/src/index.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const PRODUCT = "f1000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.products
      (id,tenant_id,store_id,slug,name,price_cents,active)
    values ('${PRODUCT}','${ids.tenantA}','${ids.storeA}','crm-prod','CRM Produto',2500,true);
  `);
});

afterAll(async () => {
  await h.db.close();
});

describe("customers + coupons", () => {
  test("cliente é isolado, pesquisável e agrega histórico real", async () => {
    const customers = createCustomerRepository(h.db);
    const orders = createOrderRepository(h.db);
    const scopeA = { tenantId: ids.tenantA, storeId: ids.storeA };
    const customer = await customers.create(scopeA, {
      name: "Maria Silva",
      phone: "(62) 99999-1111",
      email: "MARIA@EXAMPLE.COM",
      document: null,
      birthDate: null,
      notes: "Cliente recorrente",
    });
    const order = await orders.createFromCart(scopeA, {
      idempotencyKey: "customer-history",
      origin: "manual",
      customerName: customer.name,
      customerPhone: customer.phone,
      notes: null,
      shippingCents: 0,
      items: [{ productId: PRODUCT, variantId: null, quantity: 2 }],
    });
    await h.db.query(
      `update public.orders set customer_id=$4,status='completed',payment_status='paid',
       completed_at=now() where tenant_id=$1 and store_id=$2 and id=$3`,
      [ids.tenantA, ids.storeA, order.id, customer.id],
    );

    const search = await customers.list(scopeA, "99999", 20);
    expect(search.map((item) => item.id)).toContain(customer.id);

    const detail = await customers.getById(scopeA, customer.id);
    expect(detail?.orderCount).toBe(1);
    expect(detail?.totalSpentCents).toBe(5000);
    expect(detail?.orders[0]?.id).toBe(order.id);

    const other = await customers.getById(
      { tenantId: ids.tenantB, storeId: ids.storeB },
      customer.id,
    );
    expect(other).toBeNull();
  });

  test("checkout aplica cupom uma vez e grava snapshot", async () => {
    const coupons = createCouponRepository(h.db);
    const orders = createOrderRepository(h.db);
    const scope = { tenantId: ids.tenantA, storeId: ids.storeA };
    await coupons.create(scope, {
      code: "CHECKOUT10",
      name: "Checkout 10",
      active: true,
      discountType: "percentage",
      discountValue: 10,
      minimumOrderCents: 1000,
      startsAt: null,
      endsAt: null,
      usageLimit: 5,
    });
    const input = {
      idempotencyKey: "coupon-checkout",
      origin: "whatsapp" as const,
      customerName: null,
      customerPhone: null,
      couponCode: "checkout10",
      notes: null,
      shippingCents: 0,
      items: [{ productId: PRODUCT, variantId: null, quantity: 2 }],
    };
    const first = await orders.createFromCart(scope, input);
    const second = await orders.createFromCart(scope, input);
    expect(first.id).toBe(second.id);
    expect(first.subtotalCents).toBe(5000);
    expect(first.discountCents).toBe(500);
    expect(first.totalCents).toBe(4500);
    expect(first.couponCodeSnapshot).toBe("CHECKOUT10");
    const coupon = await coupons.getByCode(scope, "CHECKOUT10");
    expect(coupon?.usageCount).toBe(1);
  });

  test("cupom da outra loja não é encontrado", async () => {
    const coupons = createCouponRepository(h.db);
    const coupon = await coupons.create(
      { tenantId: ids.tenantA, storeId: ids.storeA },
      {
        code: "promo10",
        name: "Promo 10",
        active: true,
        discountType: "percentage",
        discountValue: 10,
        minimumOrderCents: 1000,
        startsAt: null,
        endsAt: null,
        usageLimit: 20,
      },
    );
    expect(coupon.code).toBe("PROMO10");
    const fromOther = await coupons.getByCode(
      { tenantId: ids.tenantB, storeId: ids.storeB },
      "PROMO10",
    );
    expect(fromOther).toBeNull();
  });
});
