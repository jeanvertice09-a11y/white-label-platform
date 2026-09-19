import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DEMO_COUNTS, DEMO_STORES, DEMO_TENANTS } from "../../scripts/homologation/fixtures/data.ts";
import { stableUuid } from "../../scripts/homologation/model.ts";
import { cleanupHomologationSeed, applyHomologationSeed } from "../../scripts/homologation/seed.ts";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { homologationTestConfig, prepareHomologationHarness } from "./homologation-fixture.ts";

let h: Harness;
const config = homologationTestConfig();
const tenantIds = DEMO_TENANTS.map((tenant) => tenant.id);
const UNRELATED_TENANT = stableUuid("test:unrelated-tenant");

async function scalar(sql: string, params: unknown[] = []): Promise<number> {
  const rows = await h.db.query(sql, params);
  return Number(rows[0]?.["total"] ?? 0);
}

async function centralCounts(): Promise<Record<string, number>> {
  return {
    tenants: await scalar("select count(*)::int total from public.tenants where id=any($1::uuid[])", [tenantIds]),
    stores: await scalar("select count(*)::int total from public.stores where tenant_id=any($1::uuid[])", [tenantIds]),
    products: await scalar("select count(*)::int total from public.products where tenant_id=any($1::uuid[])", [tenantIds]),
    variants: await scalar("select count(*)::int total from public.product_variants where tenant_id=any($1::uuid[])", [tenantIds]),
    customers: await scalar("select count(*)::int total from public.customers where tenant_id=any($1::uuid[])", [tenantIds]),
    orders: await scalar("select count(*)::int total from public.orders where tenant_id=any($1::uuid[])", [tenantIds]),
  };
}

beforeAll(async () => {
  h = await setupDatabase();
  await prepareHomologationHarness(h, config);
  await h.db.query(
    "insert into public.tenants(id,slug,name,status) values ($1::uuid,'unrelated-hml-guard','Unrelated Guard','active')",
    [UNRELATED_TENANT],
  );
  await applyHomologationSeed(h.db, config);
});

afterAll(async () => { await h.db.close(); });

describe("homologation seed database", () => {
  test("cria exatamente a massa central e preserva os dois layouts", async () => {
    expect(await centralCounts()).toEqual({
      tenants: 2, stores: 4, products: 72, variants: 92, customers: 48, orders: 64,
    });
    const layouts = await h.db.query(
      `select layout,count(*)::int total from public.catalog_settings
       where tenant_id=any($1::uuid[]) group by layout order by layout`, [tenantIds],
    );
    expect(layouts).toEqual([{ layout: "classic", total: 2 }, { layout: "modern", total: 2 }]);
  });

  test("operações, CRM, marketing e billing têm as quantidades reconciliáveis", async () => {
    const tables: Array<[string, number]> = [
      ["merchant_suppliers", DEMO_COUNTS.suppliers], ["merchant_purchases", DEMO_COUNTS.purchases],
      ["merchant_financial_entries", DEMO_COUNTS.financeEntries], ["merchant_tasks", DEMO_COUNTS.tasks],
      ["coupons", DEMO_COUNTS.coupons], ["marketing_campaigns", DEMO_COUNTS.campaigns],
      ["billing_invoices", DEMO_COUNTS.invoices], ["payments", DEMO_COUNTS.payments],
    ];
    for (const [table, count] of tables) {
      expect(await scalar(`select count(*)::int total from public.${table} where tenant_id=any($1::uuid[])`, [tenantIds])).toBe(count);
    }
    expect(await scalar("select count(*)::int total from public.marketing_consents where tenant_id=any($1::uuid[])", [tenantIds])).toBe(24);
    expect(await scalar("select count(*)::int total from public.marketing_campaign_recipients where tenant_id=any($1::uuid[])", [tenantIds])).toBe(12);
    expect(await scalar("select count(*)::int total from public.billing_events where tenant_id=any($1::uuid[])", [tenantIds])).toBe(14);
    expect(await scalar("select count(*)::int total from public.webhook_events")).toBe(0);
  });

  test("estoque materializado é exatamente a soma do ledger", async () => {
    const mismatches = await scalar(
      `select count(*)::int total from (
         select v.id from public.product_variants v
         where v.tenant_id=any($1::uuid[])
           and v.stock_quantity<>coalesce((select sum(sm.delta)::int from public.stock_movements sm where sm.tenant_id=v.tenant_id and sm.store_id=v.store_id and sm.product_id=v.product_id and sm.variant_id=v.id),0)
         union all
         select p.id from public.products p where p.tenant_id=any($1::uuid[])
           and not exists(select 1 from public.product_variants v where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id)
           and p.stock_quantity<>coalesce((select sum(sm.delta)::int from public.stock_movements sm where sm.tenant_id=p.tenant_id and sm.store_id=p.store_id and sm.product_id=p.id and sm.variant_id is null),0)
       ) x`, [tenantIds],
    );
    expect(mismatches).toBe(0);
    expect(await scalar("select count(*)::int total from public.products where tenant_id=any($1::uuid[]) and stock_quantity<0", [tenantIds])).toBe(0);
  });

  test("pedidos, compras e níveis financeiros preservam contratos reais", async () => {
    expect(await scalar(
      "select count(*)::int total from public.orders where tenant_id=any($1::uuid[]) and total_cents<>subtotal_cents-discount_cents+shipping_cents", [tenantIds],
    )).toBe(0);
    expect(await scalar(
      `select count(*)::int total from public.merchant_purchases p where p.tenant_id=any($1::uuid[])
       and p.subtotal_cents<>coalesce((select sum(i.subtotal_cents) from public.merchant_purchase_items i where i.tenant_id=p.tenant_id and i.store_id=p.store_id and i.purchase_id=p.id),0)`, [tenantIds],
    )).toBe(0);
    const paymentLevels = await h.db.query(
      "select level,count(*)::int total from public.payments where tenant_id=any($1::uuid[]) group by level order by level", [tenantIds],
    );
    expect(paymentLevels).toEqual([
      { level: "platform_billing", total: 6 }, { level: "store_checkout", total: 16 }, { level: "tenant_billing", total: 7 },
    ]);
  });

  test("rerun é idempotente e não duplica a massa", async () => {
    const before = await centralCounts();
    await applyHomologationSeed(h.db, config);
    expect(await centralCounts()).toEqual(before);
    expect(await scalar("select count(*)::int total from public.payments where tenant_id=any($1::uuid[])", [tenantIds])).toBe(29);
  });

  test("FK composta e RLS continuam bloqueando cross-tenant/cross-store", async () => {
    const storeB = DEMO_STORES[2];
    expect(storeB).toBeDefined();
    await expectReject(h.db.query(
      `insert into public.products(tenant_id,store_id,slug,name,price_cents)
       values ($1::uuid,$2::uuid,'cross-hml','Cross HML',100)`,
      [DEMO_TENANTS[0]?.id, storeB?.id],
    ), "cross tenant/store");
    const ownerA = config.storeOwners.lume;
    await h.asUser(ownerA, "authenticated", async () => {
      expect(await scalar("select count(*)::int total from public.products")).toBe(18);
      expect(await scalar("select count(*)::int total from public.products where store_id=$1::uuid", [storeB?.id])).toBe(0);
    });
  });

  test("cleanup remove exclusivamente a massa determinística", async () => {
    await cleanupHomologationSeed(h.db);
    expect(await scalar("select count(*)::int total from public.tenants where id=any($1::uuid[])", [tenantIds])).toBe(0);
    expect(await scalar("select count(*)::int total from public.payments where tenant_id=any($1::uuid[])", [tenantIds])).toBe(0);
    expect(await scalar("select count(*)::int total from public.tenants where id=$1::uuid", [UNRELATED_TENANT])).toBe(1);
  });
});
