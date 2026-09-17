// REAL DATABASE: isolamento financeiro por nível no PostgreSQL.
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupDatabase, expectReject } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedSql, seedIds } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const G = {
  plat: "a0000000-0000-4000-8000-000000000001",
  tenA: "a0000000-0000-4000-8000-0000000000aa",
  tenB: "a0000000-0000-4000-8000-0000000000bb",
  storeA: "a0000000-0000-4000-8000-0000000000a1",
  storeB: "a0000000-0000-4000-8000-0000000000b1",
};

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
insert into public.gateway_accounts (id, level, tenant_id, store_id, provider, label) values
  ('${G.plat}', 'platform_billing', null, null, 'asaas', 'gw plat'),
  ('${G.tenA}', 'tenant_billing', '${ids.tenantA}', null, 'asaas', 'gw tenA'),
  ('${G.tenB}', 'tenant_billing', '${ids.tenantB}', null, 'asaas', 'gw tenB'),
  ('${G.storeA}', 'store_checkout', '${ids.tenantA}', '${ids.storeA}', 'mercadopago', 'gw storeA'),
  ('${G.storeB}', 'store_checkout', '${ids.tenantB}', '${ids.storeB}', 'mercadopago', 'gw storeB')
on conflict (id) do nothing;`);
});

afterAll(async () => {
  await h.db.close();
});

describe("constraints reais: billing/payments (PostgreSQL)", () => {
  test("payment Tenant A + gateway Tenant B rejeitado (trigger)", async () => {
    await expectReject(
      h.db.query(
        `insert into public.payments (level, tenant_id, gateway_account_id, amount_cents) values ('tenant_billing', '${ids.tenantA}', '${G.tenB}', 100)`,
      ),
      "payment A + gateway B",
    );
  });
  test("payment store_checkout A + gateway Store B rejeitado", async () => {
    await expectReject(
      h.db.query(
        `insert into public.payments (level, tenant_id, store_id, gateway_account_id, amount_cents) values ('store_checkout', '${ids.tenantA}', '${ids.storeA}', '${G.storeB}', 100)`,
      ),
      "checkout A + gateway B",
    );
  });
  test("payment com nível divergente do gateway rejeitado", async () => {
    await expectReject(
      h.db.query(
        `insert into public.payments (level, tenant_id, gateway_account_id, amount_cents) values ('platform_billing', '${ids.tenantA}', '${G.tenA}', 100)`,
      ),
      "level mismatch",
    );
  });
  test("gateway store com tenant divergente da store rejeitado", async () => {
    await expectReject(
      h.db.query(
        `insert into public.gateway_accounts (level, tenant_id, store_id, provider, label) values ('store_checkout', '${ids.tenantA}', '${ids.storeB}', 'asaas', 'x')`,
      ),
      "gateway A + store B",
    );
  });
  test("subscription com tenant ausente rejeitada", async () => {
    await expectReject(
      h.db.query(`insert into public.subscriptions (level, status) values ('tenant_billing', 'active')`),
      "subscription sem tenant",
    );
  });
  test("fluxos válidos passam (platform/tenant/store)", async () => {
    const p1 = await h.db.query(
      `insert into public.payments (level, tenant_id, gateway_account_id, amount_cents) values ('platform_billing', '${ids.tenantA}', '${G.plat}', 100) returning id`,
    );
    const p2 = await h.db.query(
      `insert into public.payments (level, tenant_id, gateway_account_id, amount_cents) values ('tenant_billing', '${ids.tenantA}', '${G.tenA}', 100) returning id`,
    );
    const p3 = await h.db.query(
      `insert into public.payments (level, tenant_id, store_id, gateway_account_id, amount_cents) values ('store_checkout', '${ids.tenantA}', '${ids.storeA}', '${G.storeA}', 100) returning id`,
    );
    expect(p1.length + p2.length + p3.length).toBe(3);
  });
});
