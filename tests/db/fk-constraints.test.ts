// REAL DATABASE: PostgreSQL rejeita inconsistências cross-tenant (engine real).
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupDatabase, expectReject } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedSql, seedIds } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const GX = {
  catB: "c0000000-0000-4000-8000-00000000000b",
  prodA: "d0000000-0000-4000-8000-0000000000aa",
  prodB: "d0000000-0000-4000-8000-0000000000bb",
  orderB: "e0000000-0000-4000-8000-0000000000bb",
  storeX: "f0000000-0000-4000-8000-0000000000aa",
};

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
insert into public.categories (id, tenant_id, store_id, slug, name) values
  ('${GX.catB}', '${ids.tenantB}', '${ids.storeB}', 'cat-b', 'Cat B')
on conflict (id) do nothing;
insert into public.products (id, tenant_id, store_id, slug, name, price_cents) values
  ('${GX.prodA}', '${ids.tenantA}', '${ids.storeA}', 'prod-a', 'Prod A', 100),
  ('${GX.prodB}', '${ids.tenantB}', '${ids.storeB}', 'prod-b', 'Prod B', 200)
on conflict (id) do nothing;
insert into public.orders (id, tenant_id, store_id, total_cents) values
  ('${GX.orderB}', '${ids.tenantB}', '${ids.storeB}', 200)
on conflict (id) do nothing;`);
});

afterAll(async () => {
  await h.db.close();
});

describe("constraints reais: tenant/store (PostgreSQL)", () => {
  test("store_members Tenant A + Store B rejeitado", async () => {
    await expectReject(
      h.db.query(
        `insert into public.store_members (tenant_id, store_id, user_id, role) values ('${ids.tenantA}', '${ids.storeB}', '${ids.users.storeA}', 'store_staff')`,
      ),
      "store_members A+B",
    );
  });
  test("product A + category B rejeitado", async () => {
    await expectReject(
      h.db.query(
        `insert into public.products (tenant_id, store_id, category_id, slug, name, price_cents) values ('${ids.tenantA}', '${ids.storeA}', '${GX.catB}', 'x', 'X', 1)`,
      ),
      "product+category cross",
    );
  });
  test("order_item A + order B rejeitado", async () => {
    await expectReject(
      h.db.query(
        `insert into public.order_items (tenant_id, store_id, order_id, qty, unit_cents) values ('${ids.tenantA}', '${ids.storeA}', '${GX.orderB}', 1, 1)`,
      ),
      "item+order cross",
    );
  });
  test("order_item A + product B rejeitado", async () => {
    await expectReject(
      h.db.query(
        `insert into public.order_items (tenant_id, store_id, order_id, product_id, qty, unit_cents) values ('${ids.tenantA}', '${ids.storeA}', (select id from public.orders where tenant_id='${ids.tenantA}' limit 1), '${GX.prodB}', 1, 1)`,
      ),
      "item+product cross",
    );
  });
  test("stock_movement A + product B rejeitado", async () => {
    await expectReject(
      h.db.query(
        `insert into public.stock_movements (tenant_id, store_id, product_id, delta, reason) values ('${ids.tenantA}', '${ids.storeA}', '${GX.prodB}', 1, 't')`,
      ),
      "stock+product cross",
    );
  });
  test("domain Tenant A + Store B rejeitado", async () => {
    await expectReject(
      h.db.query(
        `insert into public.domains (tenant_id, store_id, hostname, type, status, verified_at) values ('${ids.tenantA}', '${ids.storeB}', 'xb.localhost', 'store_catalog', 'active', now())`,
      ),
      "domain A+B",
    );
  });
  test("audit_log Tenant A + Store B rejeitado", async () => {
    await expectReject(
      h.db.query(
        `insert into public.audit_logs (tenant_id, store_id, action, resource_type) values ('${ids.tenantA}', '${ids.storeB}', 't', 't')`,
      ),
      "audit A+B",
    );
  });
  test("media_asset Tenant A + Store B rejeitado", async () => {
    await expectReject(
      h.db.query(
        `insert into public.media_assets (tenant_id, store_id, object_key, mime, size_bytes) values ('${ids.tenantA}', '${ids.storeB}', 'k', 'image/png', 10)`,
      ),
      "media A+B",
    );
  });
  test("inserts válidos do mesmo escopo passam", async () => {
    const rows = await h.db.query(
      `insert into public.stock_movements (tenant_id, store_id, product_id, delta, reason) values ('${ids.tenantA}', '${ids.storeA}', '${GX.prodA}', 1, 'ok') returning id`,
    );
    expect(rows.length).toBe(1);
  });
});
