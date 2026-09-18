import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createStoreSubscription,
  hasFeature,
  listTenantPlanCatalog,
  loadStoreEntitlementSnapshot,
  replaceTenantPlanEntitlements,
  saveTenantPlan,
  updateStoreSubscriptionStatus,
} from "../../packages/billing/src/index.ts";
import { setupDatabase, expectReject } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
let templateId = "";
let planA = "";
let planB = "";

function requiredString(rows: Record<string, unknown>[], key: string): string {
  if (rows.length === 0) throw new Error(`linha ausente para ${key}`);
  const value = rows[0][key];
  if (typeof value !== "string") throw new Error(`campo inválido: ${key}`);
  return value;
}

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  const templates = await h.db.query(
    "select id from public.plan_templates where code='monthly_complete' limit 1",
  );
  templateId = requiredString(templates, "id");
  await h.db.query(
    `insert into public.plan_template_entitlements
      (template_id,entitlement_key,enabled,limit_value)
     values ($1,'products',true,null),($1,'reports',false,null),($1,'max_products',null,100)`,
    [templateId],
  );
  planA = await saveTenantPlan(h.db, ids.tenantA, {
    templateId,
    slug: "completo-a",
    name: "Completo A",
    description: null,
    priceCents: 1299,
    billingInterval: "monthly",
    active: true,
    trialEnabled: true,
    trialDays: 7,
    displayOrder: 10,
    recommended: true,
  });
  planB = await saveTenantPlan(h.db, ids.tenantB, {
    templateId,
    slug: "completo-b",
    name: "Completo B",
    description: null,
    priceCents: 2599,
    billingInterval: "monthly",
    active: true,
    trialEnabled: false,
    trialDays: 0,
    displayOrder: 10,
    recommended: false,
  });
  await replaceTenantPlanEntitlements(h.db, ids.tenantA, planA, [
    { key: "products", kind: "feature", enabled: true, limitValue: null },
    { key: "max_products", kind: "limit", enabled: null, limitValue: 25 },
  ]);
});

afterAll(async () => {
  await h.db.close();
});

describe("commercial plans, subscriptions and billing", () => {
  test("Tenant A lista somente seus planos comerciais", async () => {
    const catalog = await listTenantPlanCatalog(h.db, ids.tenantA);
    expect(catalog.plans.map((plan) => plan.id)).toContain(planA);
    expect(catalog.plans.map((plan) => plan.id)).not.toContain(planB);
  });

  test("Tenant A não altera plano privado do Tenant B", async () => {
    await expectReject(
      replaceTenantPlanEntitlements(h.db, ids.tenantA, planB, [
        { key: "products", kind: "feature", enabled: false, limitValue: null },
      ]),
      "Tenant A alterando plano do Tenant B",
    );
  });

  test("feature e limite não podem exceder teto Kataluu", async () => {
    await expectReject(
      replaceTenantPlanEntitlements(h.db, ids.tenantA, planA, [
        { key: "reports", kind: "feature", enabled: true, limitValue: null },
      ]),
      "feature bloqueada pelo template Kataluu",
    );
    await expectReject(
      replaceTenantPlanEntitlements(h.db, ids.tenantA, planA, [
        { key: "max_products", kind: "limit", enabled: null, limitValue: 101 },
      ]),
      "limite acima do teto Kataluu",
    );
    await replaceTenantPlanEntitlements(h.db, ids.tenantA, planA, [
      { key: "products", kind: "feature", enabled: true, limitValue: null },
      { key: "max_products", kind: "limit", enabled: null, limitValue: 25 },
    ]);
  });

  test("Store A não assina plano do Tenant B", async () => {
    await expectReject(
      createStoreSubscription(
        h.db,
        { tenantId: ids.tenantA, storeId: ids.storeA },
        planB,
        false,
      ),
      "Store A assinando plano do Tenant B",
    );
  });

  test("plano inativo não recebe nova assinatura", async () => {
    await h.db.query(
      "update public.tenant_plans set active=false where tenant_id=$1 and id=$2",
      [ids.tenantA, planA],
    );
    await expectReject(
      createStoreSubscription(
        h.db,
        { tenantId: ids.tenantA, storeId: ids.storeA },
        planA,
        false,
      ),
      "assinatura em plano inativo",
    );
    await h.db.query(
      "update public.tenant_plans set active=true where tenant_id=$1 and id=$2",
      [ids.tenantA, planA],
    );
  });

  test("trial válido funciona sem pagamento confirmado", async () => {
    const subscriptionId = await createStoreSubscription(
      h.db,
      { tenantId: ids.tenantA, storeId: ids.storeA },
      planA,
      true,
    );
    const rows = await h.db.query(
      "select status,trial_started_at,trial_ends_at from public.store_subscriptions where id=$1",
      [subscriptionId],
    );
    expect(rows[0]?.["status"]).toBe("trialing");
    expect(rows[0]?.["trial_started_at"]).not.toBeNull();
    expect(rows[0]?.["trial_ends_at"]).not.toBeNull();
    const payments = await h.db.query(
      "select count(*)::integer as n from public.payments where tenant_id=$1",
      [ids.tenantA],
    );
    expect(Number(payments[0]?.["n"])).toBe(0);
    const snapshot = await loadStoreEntitlementSnapshot(h.db, {
      tenantId: ids.tenantA,
      storeId: ids.storeA,
    });
    expect(hasFeature(snapshot, "products")).toBe(true);
  });

  test("trial expirado, suspended e canceled deixam de conceder entitlement", async () => {
    const current = await h.db.query(
      "select id from public.store_subscriptions where tenant_id=$1 and store_id=$2 limit 1",
      [ids.tenantA, ids.storeA],
    );
    const subscriptionId = requiredString(current, "id");
    await h.db.query(
      "update public.store_subscriptions set trial_ends_at=now()-interval '1 day' where id=$1",
      [subscriptionId],
    );
    let snapshot = await loadStoreEntitlementSnapshot(h.db, { tenantId: ids.tenantA, storeId: ids.storeA });
    expect(hasFeature(snapshot, "products")).toBe(false);

    await updateStoreSubscriptionStatus(
      h.db,
      { tenantId: ids.tenantA, storeId: ids.storeA },
      subscriptionId,
      "active",
    );
    await updateStoreSubscriptionStatus(
      h.db,
      { tenantId: ids.tenantA, storeId: ids.storeA },
      subscriptionId,
      "suspended",
    );
    snapshot = await loadStoreEntitlementSnapshot(h.db, { tenantId: ids.tenantA, storeId: ids.storeA });
    expect(hasFeature(snapshot, "products")).toBe(false);

    await updateStoreSubscriptionStatus(
      h.db,
      { tenantId: ids.tenantA, storeId: ids.storeA },
      subscriptionId,
      "active",
    );
    await updateStoreSubscriptionStatus(
      h.db,
      { tenantId: ids.tenantA, storeId: ids.storeA },
      subscriptionId,
      "canceled",
    );
    snapshot = await loadStoreEntitlementSnapshot(h.db, { tenantId: ids.tenantA, storeId: ids.storeA });
    expect(hasFeature(snapshot, "products")).toBe(false);
  });

  test("preço em centavos é preservado e valores negativos são rejeitados", async () => {
    const rows = await h.db.query(
      "select price_cents from public.tenant_plans where tenant_id=$1 and id=$2",
      [ids.tenantA, planA],
    );
    expect(Number(rows[0]?.["price_cents"])).toBe(1299);
    await expectReject(
      h.db.query(
        `insert into public.tenant_plans
          (tenant_id,template_id,slug,name,price_cents,billing_interval,trial_enabled,trial_days)
         select $1,id,'negativo','Negativo',-1,'monthly',false,0
         from public.plan_templates where code='monthly_entry'`,
        [ids.tenantA],
      ),
      "tenant plan com preço negativo",
    );
  });

  test("trial_days inválido é rejeitado pelo banco", async () => {
    await expectReject(
      h.db.query(
        `insert into public.tenant_plans
          (tenant_id,template_id,slug,name,price_cents,billing_interval,trial_enabled,trial_days)
         select $1,id,'trial-invalido','Trial inválido',0,'monthly',true,366
         from public.plan_templates where code='monthly_entry'`,
        [ids.tenantA],
      ),
      "trial_days acima de 365",
    );
  });

  test("níveis de billing e invoice não se misturam", async () => {
    const invoice = await h.db.query(
      `insert into public.billing_invoices
        (level,tenant_id,store_id,period_start,period_end)
       values ('platform_billing',$1,null,now()-interval '1 day',now())
       returning id`,
      [ids.tenantA],
    );
    const invoiceId = requiredString(invoice, "id");
    await expectReject(
      h.db.query(
        `insert into public.billing_events
          (level,tenant_id,store_id,invoice_id,event_type,quantity,unit_cents,total_cents,
           period_start,period_end,idempotency_key)
         values ('tenant_billing',$1,$2,$3,'store_usage',1,100,100,
           now()-interval '1 day',now(),'mixed-level')`,
        [ids.tenantA, ids.storeA, invoiceId],
      ),
      "evento tenant_billing em invoice platform_billing",
    );
  });

  test("billing event é idempotente por nível/escopo/chave", async () => {
    await h.db.query(
      `insert into public.billing_events
        (level,tenant_id,store_id,event_type,quantity,unit_cents,total_cents,
         period_start,period_end,idempotency_key)
       values ('platform_billing',$1,null,'active_store',1,990,990,
         now()-interval '1 day',now(),'same-event')`,
      [ids.tenantA],
    );
    await expectReject(
      h.db.query(
        `insert into public.billing_events
          (level,tenant_id,store_id,event_type,quantity,unit_cents,total_cents,
           period_start,period_end,idempotency_key)
         values ('platform_billing',$1,null,'active_store',1,990,990,
           now()-interval '1 day',now(),'same-event')`,
        [ids.tenantA],
      ),
      "evento faturável duplicado",
    );
  });
});
