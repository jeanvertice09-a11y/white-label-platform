import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
let templateId = "";
const ids = seedIds();

const LOT2_TABLES = [
  "entitlement_definitions",
  "plan_templates",
  "plan_template_entitlements",
  "tenant_plans",
  "tenant_plan_entitlements",
  "store_subscriptions",
  "platform_billing_rates",
  "billing_invoices",
  "billing_events",
] as const;

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  const templates = await h.db.query(
    "select id from public.plan_templates where code='monthly_entry' limit 1",
  );
  if (templates.length === 0 || typeof templates[0]["id"] !== "string") {
    throw new Error("template monthly_entry ausente");
  }
  templateId = templates[0]["id"];
  await h.db.query(
    `insert into public.tenant_plans
      (tenant_id,template_id,slug,name,price_cents,billing_interval,trial_enabled,trial_days)
     values ($1,$2,'isolamento-a','Isolamento A',1000,'monthly',false,0)`,
    [ids.tenantA, templateId],
  );
});

afterAll(async () => {
  await h.db.close();
});

describe("lot2 commercial billing isolation", () => {
  test("todas as tabelas novas mantêm RLS habilitada sem policy permissiva", async () => {
    const rows = await h.db.query(
      `select c.relname,c.relrowsecurity
       from pg_class c
       join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public'
         and c.relname in (
           'entitlement_definitions','plan_templates','plan_template_entitlements',
           'tenant_plans','tenant_plan_entitlements','store_subscriptions',
           'platform_billing_rates','billing_invoices','billing_events'
         )
       order by c.relname`,
    );
    expect(rows).toHaveLength(LOT2_TABLES.length);
    expect(rows.every((row) => row["relrowsecurity"] === true)).toBe(true);

    const policies = await h.db.query(
      `select tablename from pg_policies
       where schemaname='public'
         and tablename in (
           'entitlement_definitions','plan_templates','plan_template_entitlements',
           'tenant_plans','tenant_plan_entitlements','store_subscriptions',
           'platform_billing_rates','billing_invoices','billing_events'
         )`,
    );
    expect(policies).toHaveLength(0);
  });

  test("authenticated não lê nem grava tenant_plans sem policy explícita", async () => {
    await h.asUser(ids.users.tenantA, "authenticated", async () => {
      const visible = await h.db.query("select id from public.tenant_plans");
      expect(visible).toHaveLength(0);
      await expectReject(
        h.db.query(
          `insert into public.tenant_plans
            (tenant_id,template_id,slug,name,price_cents,billing_interval,trial_enabled,trial_days)
           values ($1,$2,'rls-block','RLS Block',100,'monthly',false,0)`,
          [ids.tenantA, templateId],
        ),
        "authenticated inserindo tenant_plan sem policy",
      );
    });
  });

  test("store_subscription rejeita tenant A com store B por FK composta", async () => {
    await expectReject(
      h.db.query(
        `insert into public.store_subscriptions
          (tenant_id,store_id,tenant_plan_id,status)
         select $1,$2,id,'active'
         from public.tenant_plans
         where tenant_id=$1 and slug='isolamento-a'`,
        [ids.tenantA, ids.storeB],
      ),
      "store_subscription cruzando tenant/store",
    );
  });

  test("billing_invoice tenant_billing rejeita tenant A com store B", async () => {
    await expectReject(
      h.db.query(
        `insert into public.billing_invoices
          (level,tenant_id,store_id,period_start,period_end)
         values ('tenant_billing',$1,$2,now()-interval '1 day',now())`,
        [ids.tenantA, ids.storeB],
      ),
      "billing invoice cruzando tenant/store",
    );
  });
});
