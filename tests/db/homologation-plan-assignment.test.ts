import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { applyHomologationSeed } from "../../scripts/homologation/seed.ts";
import type { Harness } from "./harness.ts";
import { setupDatabase } from "./harness.ts";
import { homologationTestConfig, prepareHomologationHarness } from "./homologation-fixture.ts";

let h: Harness;
const config = homologationTestConfig();

beforeAll(async () => {
  h = await setupDatabase();
  await prepareHomologationHarness(h, config);
  await applyHomologationSeed(h.db, config);
});

afterAll(async () => { await h.db.close(); });

describe("homologation tenant plan assignments", () => {
  test("cria dois tenant_plans por White Label", async () => {
    const rows = await h.db.query(
      `select t.slug,count(*)::int total
       from public.tenant_plans p join public.tenants t on t.id=p.tenant_id
       where t.slug in ('hml-aurora-commerce','hml-nexo-varejo')
       group by t.slug order by t.slug`,
    );
    expect(rows).toEqual([
      { slug: "hml-aurora-commerce", total: 2 },
      { slug: "hml-nexo-varejo", total: 2 },
    ]);
  });

  test("cada store_subscription resolve o template e preço externos corretos", async () => {
    const rows = await h.db.query(
      `select s.slug,t.code,p.price_cents::int price_cents,p.trial_enabled,p.trial_days
       from public.store_subscriptions ss
       join public.stores s on s.id=ss.store_id and s.tenant_id=ss.tenant_id
       join public.tenant_plans p on p.id=ss.tenant_plan_id and p.tenant_id=ss.tenant_id
       join public.plan_templates t on t.id=p.template_id
       order by s.slug`,
    );
    expect(rows).toEqual([
      { slug: "hml-botanica-lab", code: "monthly_intermediate", price_cents: 7900, trial_enabled: true, trial_days: 14 },
      { slug: "hml-casa-nativa", code: "complete", price_cents: 12900, trial_enabled: false, trial_days: 0 },
      { slug: "hml-lume-atelier", code: "monthly_entry", price_cents: 4900, trial_enabled: false, trial_days: 0 },
      { slug: "hml-passo-norte", code: "monthly_complete", price_cents: 9900, trial_enabled: false, trial_days: 0 },
    ]);
  });
});
