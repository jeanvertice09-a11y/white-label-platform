import { DEMO_STORES, DEMO_TENANTS } from "./fixtures/data.ts";
import type { HomologationRuntimeConfig, SqlExecutor } from "./model.ts";
import { requireStoreDomain, stableUuid } from "./model.ts";
import { expectedAssets, requiredFeatureKeys, validateRuntimeConfig } from "./plan.ts";

function text(row: Record<string, unknown> | undefined, key: string): string {
  const value = row?.[key];
  if (typeof value !== "string") throw new Error(`preflight: campo inválido ${key}`);
  return value;
}

function bool(row: Record<string, unknown> | undefined, key: string): boolean { return row?.[key] === true; }

export interface PreflightResult {
  platformPlanId: string;
  templateId: string;
  entitlementCount: number;
}

async function verifyPlatformPlan(sql: SqlExecutor, slug: string): Promise<string> {
  const rows = await sql.query(`select id::text,active,billing_interval from public.plans where slug=$1`, [slug]);
  if (!rows[0] || !bool(rows[0], "active") || typeof rows[0]["billing_interval"] !== "string") {
    throw new Error(`preflight: plano Kataluu '${slug}' inexistente/inativo/sem billing_interval`);
  }
  return text(rows[0], "id");
}

function validateTemplateCapacity(rows: Record<string, unknown>[], config: HomologationRuntimeConfig): void {
  const features = new Map<string, boolean>(); const limits = new Map<string, number>();
  for (const row of rows) {
    if (typeof row["key"] !== "string") continue;
    if (row["kind"] === "feature") features.set(row["key"], row["enabled"] === true);
    if (row["kind"] === "limit" && Number.isSafeInteger(Number(row["limit_value"]))) limits.set(row["key"], Number(row["limit_value"]));
  }
  const missing = requiredFeatureKeys().filter((key) => features.get(key) !== true);
  if (missing.length > 0) throw new Error(`preflight: template não habilita: ${missing.join(", ")}`);
  if ((limits.get("max_products") ?? -1) < 18) throw new Error("preflight: template exige max_products >= 18");
  if ((limits.get("max_stores") ?? -1) < 2) throw new Error("preflight: template exige max_stores >= 2");
  const assetBytes = Object.values(config.resolvedAssets).reduce((sum, asset) => sum + (asset?.sizeBytes ?? 0), 0);
  if ((limits.get("max_storage_bytes") ?? -1) < assetBytes) throw new Error(`preflight: max_storage_bytes insuficiente para ${String(assetBytes)} bytes de assets`);
}

async function verifyTemplate(sql: SqlExecutor, code: string, config: HomologationRuntimeConfig): Promise<{ id: string; count: number }> {
  const rows = await sql.query(
    `select t.id::text,t.active,d.key,d.kind,e.enabled,e.limit_value
     from public.plan_templates t left join public.plan_template_entitlements e on e.template_id=t.id
     left join public.entitlement_definitions d on d.key=e.entitlement_key where t.code=$1 order by d.kind,d.key`, [code],
  );
  if (!rows[0] || !bool(rows[0], "active")) throw new Error(`preflight: template '${code}' inexistente/inativo`);
  validateTemplateCapacity(rows, config);
  return { id: text(rows[0], "id"), count: rows.filter((row) => typeof row["key"] === "string").length };
}

async function verifyNoForeignCollisions(sql: SqlExecutor): Promise<void> {
  for (const tenant of DEMO_TENANTS) {
    const rows = await sql.query(`select id::text from public.tenants where slug=$1`, [tenant.slug]);
    if (rows[0] && text(rows[0], "id") !== tenant.id) throw new Error(`preflight: slug ocupado por outro tenant: ${tenant.slug}`);
  }
  for (const store of DEMO_STORES) {
    const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
    if (!tenant) throw new Error(`preflight: tenant ausente para ${store.key}`);
    const rows = await sql.query(`select id::text from public.stores where tenant_id=$1::uuid and slug=$2`, [tenant.id, store.slug]);
    if (rows[0] && text(rows[0], "id") !== store.id) throw new Error(`preflight: slug ocupado por outra store: ${store.slug}`);
  }
}

async function verifyDomainCollisions(sql: SqlExecutor, config: HomologationRuntimeConfig): Promise<void> {
  for (const tenant of DEMO_TENANTS) {
    const domain = config.domains[tenant.key];
    const expected: Array<readonly [string, string]> = [
      [domain.tenantSite, stableUuid(`domain:${tenant.key}:site`)],
      [domain.tenantPanel, stableUuid(`domain:${tenant.key}:panel`)],
    ];
    for (const store of DEMO_STORES.filter((item) => item.tenantKey === tenant.key)) {
      const storeDomain = requireStoreDomain(config, tenant.key, store.key);
      expected.push([storeDomain.admin, stableUuid(`domain:${store.key}:admin`)]);
      expected.push([storeDomain.catalog, stableUuid(`domain:${store.key}:catalog`)]);
    }
    for (const [hostname, expectedId] of expected) {
      const rows = await sql.query(`select id::text from public.domains where hostname=$1`, [hostname]);
      if (rows[0] && text(rows[0], "id") !== expectedId) throw new Error(`preflight: hostname ocupado: ${hostname}`);
    }
  }
}

async function verifyAuthUsersWhenAvailable(sql: SqlExecutor, config: HomologationRuntimeConfig): Promise<void> {
  const exists = await sql.query(`select to_regclass('auth.users')::text as table_name`);
  if (!exists[0]?.["table_name"]) return;
  const ids = [...Object.values(config.tenantOwners), ...Object.values(config.storeOwners)];
  const placeholders = ids.map((_, index) => `$${String(index + 1)}::uuid`).join(",");
  const rows = await sql.query(`select id::text from auth.users where id in (${placeholders})`, ids);
  if (rows.length !== new Set(ids).size) throw new Error("preflight: um ou mais usuários Auth ainda não existem");
}

export async function runHomologationPreflight(sql: SqlExecutor, config: HomologationRuntimeConfig): Promise<PreflightResult> {
  validateRuntimeConfig(config);
  if (expectedAssets().length !== Object.keys(config.resolvedAssets).length) throw new Error("preflight: manifesto de assets incompleto");
  const [platformPlanId, template] = await Promise.all([
    verifyPlatformPlan(sql, config.platformPlanSlug), verifyTemplate(sql, config.planTemplateCode, config),
  ]);
  await verifyNoForeignCollisions(sql); await verifyDomainCollisions(sql, config); await verifyAuthUsersWhenAvailable(sql, config);
  return { platformPlanId, templateId: template.id, entitlementCount: template.count };
}
