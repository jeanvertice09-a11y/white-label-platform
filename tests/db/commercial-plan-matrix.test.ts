import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createStoreSubscription,
  listTenantPlanCatalog,
  loadStoreEntitlementSnapshot,
  replaceTenantPlanEntitlements,
  saveTenantPlan,
} from "../../packages/billing/src/index.ts";
import { assertProductMutationEntitlements } from "../../apps/web/src/lib/server/catalog-entitlements.server.ts";
import { assignControlMerchantPlan } from "../../apps/web/src/lib/server/control-merchants.billing.server.ts";
import { assertStoreCustomDomainEntitlement } from "../../apps/web/src/lib/server/domain-entitlements.server.ts";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql, T, U } from "./seed.ts";

const CODES = ["free", "monthly_entry", "monthly_intermediate", "monthly_complete", "complete", "complete_ecommerce"] as const;
const NAMES = ["Grátis", "Plano 1", "Plano 2", "Plano 3", "Completo", "Completo + E-commerce"];
const STORES = {
  free: "aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa",
  plan1: "aaaaaaaa-1000-4000-8000-aaaaaaaaaaab",
  plan2: "aaaaaaaa-1000-4000-8000-aaaaaaaaaaac",
  plan3: "aaaaaaaa-1000-4000-8000-aaaaaaaaaaad",
  complete: "aaaaaaaa-1000-4000-8000-aaaaaaaaaaae",
  downgrade: "aaaaaaaa-1000-4000-8000-aaaaaaaaaaaf",
} as const;

let h: Harness;
const ids = seedIds();
const templates = new Map<string, string>();
const plans = new Map<string, string>();

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Campo inválido: ${key}`);
  return value;
}

async function expectRejectedWithMessage(
  promise: Promise<unknown>,
  expectedMessage: string,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw error;
    expect(error.message).toContain(expectedMessage);
    return;
  }
  throw new Error(`Promessa deveria rejeitar com mensagem contendo: ${expectedMessage}`);
}

async function feature(code: string, key: string): Promise<boolean> {
  const rows = await h.db.query(
    `select e.enabled from public.plan_template_entitlements e
     join public.plan_templates t on t.id=e.template_id
     where t.code=$1 and e.entitlement_key=$2`,
    [code, key],
  );
  return rows[0]?.["enabled"] === true;
}

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  const rows = await h.db.query("select id::text,code from public.plan_templates where code=any($1::text[])", [CODES]);
  for (const row of rows) templates.set(stringField(row, "code"), stringField(row, "id"));
  for (const code of CODES) {
    const templateId = templates.get(code);
    if (!templateId) throw new Error(`Template ausente: ${code}`);
    const planId = await saveTenantPlan(h.db, T.a, {
      templateId,
      slug: `test-${code.replaceAll("_", "-")}`,
      name: `Teste ${code}`,
      description: null,
      priceCents: 0,
      billingInterval: "monthly",
      active: true,
      trialEnabled: false,
      trialDays: 0,
      displayOrder: plans.size,
      recommended: false,
    });
    plans.set(code, planId);
  }
  await h.db.query(
    `insert into public.stores(id,tenant_id,slug,name,status) values
     ($2,$1,'matrix-free','Matrix Free','active'),
     ($3,$1,'matrix-plan1','Matrix Plan 1','active'),
     ($4,$1,'matrix-plan2','Matrix Plan 2','active'),
     ($5,$1,'matrix-plan3','Matrix Plan 3','active'),
     ($6,$1,'matrix-complete','Matrix Complete','active'),
     ($7,$1,'matrix-downgrade','Matrix Downgrade','active')`,
    [T.a, STORES.free, STORES.plan1, STORES.plan2, STORES.plan3, STORES.complete, STORES.downgrade],
  );
  const assignments = [
    [STORES.free, "free"],
    [STORES.plan1, "monthly_entry"],
    [STORES.plan2, "monthly_intermediate"],
    [STORES.plan3, "monthly_complete"],
    [STORES.complete, "complete"],
    [STORES.downgrade, "monthly_intermediate"],
  ] as const;
  for (const [storeId, code] of assignments) {
    const planId = plans.get(code);
    if (!planId) throw new Error(`Plano ausente: ${code}`);
    await createStoreSubscription(h.db, { tenantId: T.a, storeId }, planId, false);
  }
});

afterAll(async () => h.db.close());

describe("commercial plan matrix", () => {
  test("mantém exatamente os seis templates oficiais e 22 feature keys explícitas", async () => {
    const rows = await h.db.query(
      `select t.code,t.name,t.sort_order,
        count(*) filter (where d.kind='feature')::int feature_count
       from public.plan_templates t
       join public.plan_template_entitlements e on e.template_id=t.id
       join public.entitlement_definitions d on d.key=e.entitlement_key
       where t.code=any($1::text[])
       group by t.id,t.code,t.name,t.sort_order order by t.sort_order`,
      [CODES],
    );
    expect(rows.map((row) => row["code"])).toEqual([...CODES]);
    expect(rows.map((row) => row["name"])).toEqual(NAMES);
    expect(rows.every((row) => Number(row["feature_count"]) === 22)).toBe(true);
    const invented = await h.db.query(
      "select count(*)::int total from public.entitlement_definitions where key in ('tasks','operations','categories','catalog')",
    );
    expect(Number(invented[0]?.["total"])).toBe(0);
  });

  test("mapeia as capacidades comerciais existentes sem fingir reports/e-commerce/tasks", async () => {
    expect(await feature("free", "products")).toBe(true);
    expect(await feature("free", "layouts")).toBe(false);
    expect(await feature("monthly_entry", "layouts")).toBe(true);
    expect(await feature("monthly_entry", "coupons")).toBe(true);
    expect(await feature("monthly_entry", "custom_domain")).toBe(false);
    expect(await feature("monthly_intermediate", "custom_domain")).toBe(true);
    expect(await feature("monthly_intermediate", "campaigns")).toBe(true);
    expect(await feature("monthly_intermediate", "suppliers")).toBe(true);
    expect(await feature("monthly_intermediate", "purchases")).toBe(true);
    expect(await feature("monthly_complete", "finance")).toBe(true);
    expect(await feature("complete", "reports")).toBe(false);
    expect(await feature("complete_ecommerce", "online_payments")).toBe(false);
  });

  test("persiste limites 20/100/300/1000 e omite max_products nos dois níveis sem teto", async () => {
    const rows = await h.db.query(
      `select t.code,e.limit_value::int value
       from public.plan_templates t
       left join public.plan_template_entitlements e
         on e.template_id=t.id and e.entitlement_key='max_products'
       where t.code=any($1::text[]) order by t.sort_order`,
      [CODES],
    );
    expect(rows.map((row) => row["value"] === null ? null : Number(row["value"]))).toEqual([20, 100, 300, 1000, null, null]);
  });

  test("runtime herda template e override do tenant só reduz", async () => {
    const templateId = templates.get("monthly_entry");
    if (!templateId) throw new Error("template Plano 1 ausente");
    const tenantBPlan = await saveTenantPlan(h.db, T.b, {
      templateId,
      slug: "matrix-plan1-b",
      name: "Matrix Plano 1 B",
      description: null,
      priceCents: 0,
      billingInterval: "monthly",
      active: true,
      trialEnabled: false,
      trialDays: 0,
      displayOrder: 1,
      recommended: false,
    });
    await replaceTenantPlanEntitlements(h.db, T.b, tenantBPlan, [
      { key: "coupons", kind: "feature", enabled: false, limitValue: null },
      { key: "max_products", kind: "limit", enabled: null, limitValue: 50 },
    ]);
    await createStoreSubscription(h.db, { tenantId: T.b, storeId: ids.storeB }, tenantBPlan, false);
    const snapshot = await loadStoreEntitlementSnapshot(h.db, { tenantId: T.b, storeId: ids.storeB });
    expect(snapshot?.features["layouts"]).toBe(true);
    expect(snapshot?.features["coupons"]).toBe(false);
    expect(snapshot?.limits["max_products"]).toBe(50);
    const catalog = await listTenantPlanCatalog(h.db, T.b);
    const plan = catalog.plans.find((item) => item.id === tenantBPlan);
    expect(plan?.entitlements.find((item) => item.key === "layouts")?.enabled).toBe(true);
    expect(plan?.entitlements.find((item) => item.key === "max_products")?.limitValue).toBe(50);
  });

  test("boundary server-side respeita os quatro tetos e ausência de teto", async () => {
    const cases = [
      [STORES.free, 20], [STORES.plan1, 100], [STORES.plan2, 300], [STORES.plan3, 1000],
    ] as const;
    for (const [storeId, limit] of cases) {
      await h.db.query(
        `insert into public.products(tenant_id,store_id,slug,name,price_cents)
         select $1,$2,'matrix-'||g::text,'Produto '||g::text,100
         from generate_series(1,$3::int) g`,
        [T.a, storeId, limit],
      );
      await expectRejectedWithMessage(
        assertProductMutationEntitlements(h.db, { tenantId: T.a, storeId }, "create"),
        "max_products",
      );
    }
    await h.db.query(
      `insert into public.products(tenant_id,store_id,slug,name,price_cents)
       select $1,$2,'unlimited-'||g::text,'Produto '||g::text,100
       from generate_series(1,1001) g`,
      [T.a, STORES.complete],
    );
    expect(await assertProductMutationEntitlements(
      h.db,
      { tenantId: T.a, storeId: STORES.complete },
      "create",
    )).toBeUndefined();
  });

  test("custom_domain é server-side e downgrade suspende domínio sem apagar", async () => {
    await expectRejectedWithMessage(
      assertStoreCustomDomainEntitlement(h.db, T.a, STORES.plan1),
      "custom_domain",
    );
    expect(await assertStoreCustomDomainEntitlement(h.db, T.a, STORES.plan2)).toBeUndefined();
    await h.db.query(
      `insert into public.domains(tenant_id,store_id,hostname,type,status,verified_at)
       values ($1,$2,'downgrade.example.test','store_catalog','active',now())`,
      [T.a, STORES.downgrade],
    );
    const plan1 = plans.get("monthly_entry");
    if (!plan1) throw new Error("Plano 1 ausente");
    await assignControlMerchantPlan(h.db, T.a, U.tenantA, STORES.downgrade, plan1, false);
    const domain = await h.db.query(
      "select status from public.domains where tenant_id=$1 and store_id=$2 and hostname='downgrade.example.test'",
      [T.a, STORES.downgrade],
    );
    expect(domain[0]?.["status"]).toBe("suspended");
  });

  test("plano de outro tenant/store não atravessa o boundary", async () => {
    const plan1 = plans.get("monthly_entry");
    if (!plan1) throw new Error("Plano 1 ausente");
    await expectReject(
      assignControlMerchantPlan(h.db, T.a, U.tenantA, ids.storeB, plan1, false),
      "Tenant A atribuindo plano à store do Tenant B",
    );
  });

  test("migration 0026 é idempotente e não duplica templates/entitlements", async () => {
    const path = join(import.meta.dir, "..", "..", "supabase", "migrations", "0026_commercial_plan_matrix.sql");
    await h.db.execScript(readFileSync(path, "utf8"));
    const templatesCount = await h.db.query(
      "select count(*)::int total from public.plan_templates where code=any($1::text[])",
      [CODES],
    );
    const duplicateEntitlements = await h.db.query(
      `select count(*)::int total from (
         select template_id,entitlement_key,count(*) from public.plan_template_entitlements
         group by template_id,entitlement_key having count(*)>1
       ) x`,
    );
    expect(Number(templatesCount[0]?.["total"])).toBe(6);
    expect(Number(duplicateEntitlements[0]?.["total"])).toBe(0);
  });
});
