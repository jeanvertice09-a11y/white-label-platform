import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";

let h: Harness;

beforeAll(async () => {
  h = await setupDatabase();
});

afterAll(async () => {
  await h.db.close();
});

describe("foundation hardening migration", () => {
  test("rls_auto_enable não é executável por anon/authenticated", async () => {
    const exists = await h.db.query(
      "select to_regprocedure('public.rls_auto_enable()') is not null as present",
    );
    if (!Boolean(exists[0]?.["present"])) return;

    const rows = await h.db.query(`
      select
        has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as anon_exec,
        has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') as auth_exec
    `);
    expect(rows[0]?.["anon_exec"]).toBe(false);
    expect(rows[0]?.["auth_exec"]).toBe(false);
  });

  test("self-read memberships usam auth.uid como initplan", async () => {
    const rows = await h.db.query(`
      select tablename, qual from pg_policies
      where schemaname='public'
        and policyname in (
          'tenant_members_self_read',
          'store_members_self_read',
          'platform_members_self_read'
        )
      order by tablename
    `);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(String(row["qual"])).toContain("SELECT auth.uid()");
    }
  });

  test("tabelas operacionais permanecem deny-by-default", async () => {
    const rows = await h.db.query(`
      select tablename, count(policyname)::integer as policies
      from (
        values ('catalog_settings'),('customers'),('coupons'),('domains'),
          ('payments'),('order_items'),('media_assets'),('webhook_events')
      ) as expected(tablename)
      left join pg_policies p
        on p.schemaname='public' and p.tablename=expected.tablename
      group by tablename order by tablename
    `);
    expect(rows.every((row) => Number(row["policies"]) === 0)).toBe(true);
  });

  test("índices críticos da fundação existem", async () => {
    const rows = await h.db.query(`
      select indexname from pg_indexes where schemaname='public'
    `);
    const names = new Set(rows.map((row) => String(row["indexname"])));
    for (const index of [
      "domains_tenant_store_idx",
      "products_category_scope_idx",
      "order_items_product_variant_scope_idx",
      "orders_store_created_idx",
      "subscriptions_tenant_created_idx",
      "payments_gateway_account_idx",
      "webhook_events_gateway_account_idx",
    ]) {
      expect(names.has(index)).toBe(true);
    }
  });
});
