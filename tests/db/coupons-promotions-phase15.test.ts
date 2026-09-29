import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createCouponRepository } from "../../packages/marketing/src/index.ts";
import type { CouponMutationInput } from "../../packages/marketing/src/index.ts";
import { createOrderRepository } from "../../packages/orders/src/index.ts";
import type { CreateOrderFromCartInput } from "../../packages/orders/src/index.ts";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const STORE_A2 = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaa2";
const PRODUCT_A = "f1500000-0000-4000-8000-000000000001";
const PRODUCT_A2 = "f1500000-0000-4000-8000-000000000002";
const PRODUCT_B = "f1500000-0000-4000-8000-000000000003";
const scopeA = { tenantId: ids.tenantA, storeId: ids.storeA };
const scopeA2 = { tenantId: ids.tenantA, storeId: STORE_A2 };
const scopeB = { tenantId: ids.tenantB, storeId: ids.storeB };

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.stores (id,tenant_id,slug,name,status)
    values ('${STORE_A2}','${ids.tenantA}','loja-a2','Loja A2','active');
    insert into public.products
      (id,tenant_id,store_id,slug,name,price_cents,active)
    values
      ('${PRODUCT_A}','${ids.tenantA}','${ids.storeA}','cupom-a','Produto A',2501,true),
      ('${PRODUCT_A2}','${ids.tenantA}','${STORE_A2}','cupom-a2','Produto A2',2501,true),
      ('${PRODUCT_B}','${ids.tenantB}','${ids.storeB}','cupom-b','Produto B',2501,true);
  `);
});

afterAll(async () => {
  await h.db.close();
});

function couponInput(
  code: string,
  overrides: Partial<CouponMutationInput> = {},
): CouponMutationInput {
  return {
    code,
    name: `Cupom ${code}`,
    active: true,
    discountType: "percentage",
    discountValue: 10,
    minimumOrderCents: null,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    ...overrides,
  };
}

function orderInput(
  key: string,
  productId: string,
  couponCode: string | null,
): CreateOrderFromCartInput {
  return {
    idempotencyKey: key,
    origin: "whatsapp",
    customerName: null,
    customerPhone: null,
    couponCode,
    notes: null,
    shippingCents: 0,
    items: [{ productId, variantId: null, quantity: 1 }],
  };
}

describe("phase 15 coupons + promotions", () => {
  test("admin é scoped e audita criação, edição, ativação e desativação", async () => {
    const coupons = createCouponRepository(h.db);
    const actor = ids.users.storeA;
    const created = await coupons.create(scopeA, couponInput("AUDIT15"), actor);
    expect((await coupons.list(scopeA)).map((item) => item.id)).toContain(created.id);
    expect((await coupons.list(scopeA2)).map((item) => item.id)).not.toContain(created.id);
    expect((await coupons.list(scopeB)).map((item) => item.id)).not.toContain(created.id);
    expect(await coupons.update(scopeA2, created.id, couponInput("AUDIT15"), actor)).toBeNull();

    await coupons.update(scopeA, created.id, couponInput("AUDIT15", { active: false }), actor);
    await coupons.update(scopeA, created.id, couponInput("AUDIT15", { active: true }), actor);
    await coupons.update(scopeA, created.id, couponInput("AUDIT15", { name: "Cupom auditado" }), actor);

    const rows = await h.db.query(
      `select action from public.audit_logs
       where tenant_id=$1 and store_id=$2 and resource_type='coupon' and resource_id=$3
       order by created_at,id`,
      [ids.tenantA, ids.storeA, created.id],
    );
    const expectedActions = [
      "coupon.created",
      "coupon.deactivated",
      "coupon.activated",
      "coupon.updated",
    ];
    const actions = rows.map((row) => row["action"]);
    expect(actions).toHaveLength(expectedActions.length);
    for (const action of expectedActions) expect(actions).toContain(action);
  });

  test("inexistente, inativo, expirado, futuro e subtotal insuficiente são rejeitados", async () => {
    const coupons = createCouponRepository(h.db);
    const orders = createOrderRepository(h.db);
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    await coupons.create(scopeA, couponInput("INACTIVE15", { active: false }));
    await coupons.create(scopeA, couponInput("EXPIRED15", { endsAt: past }));
    await coupons.create(scopeA, couponInput("FUTURE15", { startsAt: future }));
    await coupons.create(scopeA, couponInput("MINIMUM15", { minimumOrderCents: 9999 }));

    for (const [key, code] of [
      ["missing-15", "MISSING15"],
      ["inactive-15", "INACTIVE15"],
      ["expired-15", "EXPIRED15"],
      ["future-15", "FUTURE15"],
      ["minimum-15", "MINIMUM15"],
    ]) {
      await expectReject(
        orders.createFromCart(scopeA, orderInput(key, PRODUCT_A, code)),
        code,
      );
    }
  });

  test("percentual inválido é rejeitado e fixo nunca supera subtotal", async () => {
    const coupons = createCouponRepository(h.db);
    const orders = createOrderRepository(h.db);
    await expectReject(
      coupons.create(scopeA, couponInput("INVALID15", { discountValue: 101 })),
      "percentual > 100",
    );
    await coupons.create(scopeA, couponInput("FIXED15", {
      discountType: "fixed",
      discountValue: 99_999,
    }));
    const order = await orders.createFromCart(
      scopeA,
      orderInput("fixed-cap-15", PRODUCT_A, "FIXED15"),
    );
    expect(order.subtotalCents).toBe(2501);
    expect(order.discountCents).toBe(2501);
    expect(order.totalCents).toBe(0);
  });

  test("checkout ignora valores monetários do browser, grava snapshot e retry não duplica uso", async () => {
    const coupons = createCouponRepository(h.db);
    const orders = createOrderRepository(h.db);
    await coupons.create(scopeA, couponInput("SAFE15", { usageLimit: 5 }));
    const raw = {
      ...orderInput("safe-retry-15", PRODUCT_A, "safe15"),
      subtotalCents: 1,
      discountCents: 999_999,
      discountAmount: 999_999,
      discountPercent: 99,
      couponValue: 999_999,
      totalCents: 1,
    } as CreateOrderFromCartInput;
    const first = await orders.createFromCart(scopeA, raw);
    const retry = await orders.createFromCart(scopeA, raw);
    expect(retry.id).toBe(first.id);
    expect(first.subtotalCents).toBe(2501);
    expect(first.discountCents).toBe(250);
    expect(first.totalCents).toBe(2251);
    expect(first.couponCodeSnapshot).toBe("SAFE15");
    expect(first.couponId).not.toBeNull();
    expect((await coupons.getByCode(scopeA, "SAFE15"))?.usageCount).toBe(1);

    await orders.cancel(scopeA, first.id, ids.users.storeA);
    expect((await coupons.getByCode(scopeA, "SAFE15"))?.usageCount).toBe(1);
  });

  test("cupom não atravessa store nem tenant no checkout", async () => {
    const coupons = createCouponRepository(h.db);
    const orders = createOrderRepository(h.db);
    await coupons.create(scopeA, couponInput("SCOPED15"));
    await expectReject(
      orders.createFromCart(scopeA2, orderInput("cross-store-15", PRODUCT_A2, "SCOPED15")),
      "cross-store",
    );
    await expectReject(
      orders.createFromCart(scopeB, orderInput("cross-tenant-15", PRODUCT_B, "SCOPED15")),
      "cross-tenant",
    );
  });

  test("limite total é atômico sob tentativas concorrentes", async () => {
    const coupons = createCouponRepository(h.db);
    const orders = createOrderRepository(h.db);
    await coupons.create(scopeA, couponInput("ONEUSE15", { usageLimit: 1 }));
    const results = await Promise.allSettled([
      orders.createFromCart(scopeA, orderInput("one-use-a-15", PRODUCT_A, "ONEUSE15")),
      orders.createFromCart(scopeA, orderInput("one-use-b-15", PRODUCT_A, "ONEUSE15")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await coupons.getByCode(scopeA, "ONEUSE15"))?.usageCount).toBe(1);
    const count = await h.db.query(
      `select count(*)::int as total from public.orders
       where tenant_id=$1 and store_id=$2 and coupon_code_snapshot='ONEUSE15'`,
      [ids.tenantA, ids.storeA],
    );
    expect(Number(count[0]?.["total"])).toBe(1);
  });
});
