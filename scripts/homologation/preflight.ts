import { PLATFORM_GATEWAY_ID } from "./cleanup.ts";
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

function assertLimitCapacity(limits: Map<string, number>, key: string, minimum: number, message: string): void {
  const configured = limits.get(key);
  if (configured !== undefined && configured < minimum) throw new Error(message);
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
  assertLimitCapacity(limits, "max_products", 18, "preflight: max_products configurado é menor que 18");
  assertLimitCapacity(limits, "max_stores", 2, "preflight: max_stores configurado é menor que 2");
  const assetBytes = Object.values(config.resolvedAssets).reduce((sum, asset) => sum + (asset?.sizeBytes ?? 0), 0);
  assertLimitCapacity(limits, "max_storage_bytes", assetBytes, `preflight: max_storage_bytes configurado é insuficiente para ${String(assetBytes)} bytes de assets`);
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

async function verifyTenantIdentity(sql: SqlExecutor, tenant: (typeof DEMO_TENANTS)[number]): Promise<void> {
  const byId = await sql.query(`select slug from public.tenants where id=$1::uuid`, [tenant.id]);
  if (byId[0] && byId[0]["slug"] !== tenant.slug) throw new Error(`preflight: ID determinístico pertence a outro tenant: ${tenant.id}`);
  const bySlug = await sql.query(`select id::text from public.tenants where slug=$1`, [tenant.slug]);
  if (bySlug[0] && text(bySlug[0], "id") !== tenant.id) throw new Error(`preflight: slug ocupado por outro tenant: ${tenant.slug}`);
}

async function verifyStoreIdentity(sql: SqlExecutor, store: (typeof DEMO_STORES)[number]): Promise<void> {
  const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
  if (!tenant) throw new Error(`preflight: tenant ausente para ${store.key}`);
  const byId = await sql.query(`select tenant_id::text,slug from public.stores where id=$1::uuid`, [store.id]);
  if (byId[0] && (byId[0]["tenant_id"] !== tenant.id || byId[0]["slug"] !== store.slug)) {
    throw new Error(`preflight: ID determinístico pertence a outra store: ${store.id}`);
  }
  const bySlug = await sql.query(`select id::text from public.stores where tenant_id=$1::uuid and slug=$2`, [tenant.id, store.slug]);
  if (bySlug[0] && text(bySlug[0], "id") !== store.id) throw new Error(`preflight: slug ocupado por outra store: ${store.slug}`);
}

async function verifyGatewayIdentity(sql: SqlExecutor): Promise<void> {
  const rows = await sql.query(
    `select level,tenant_id::text,store_id::text,public_identifier
     from public.gateway_accounts where id=$1::uuid`, [PLATFORM_GATEWAY_ID],
  );
  const row = rows[0];
  if (!row) return;
  if (row["level"] !== "platform_billing" || row["tenant_id"] !== null || row["store_id"] !== null || row["public_identifier"] !== "hml-internal-only") {
    throw new Error(`preflight: ID determinístico do gateway pertence a outro registro: ${PLATFORM_GATEWAY_ID}`);
  }
}

async function verifyNoForeignCollisions(sql: SqlExecutor): Promise<void> {
  for (const tenant of DEMO_TENANTS) await verifyTenantIdentity(sql, tenant);
  for (const store of DEMO_STORES) await verifyStoreIdentity(sql, store);
  await verifyGatewayIdentity(sql);
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

async function verifyAuthUsers(sql: SqlExecutor, config: HomologationRuntimeConfig): Promise<void> {
  const exists = await sql.query(`select to_regclass('auth.users')::text as table_name`);
  if (!exists[0]?.["table_name"]) throw new Error("preflight: auth.users indisponível; validação Auth é obrigatória");
  const ids = [...Object.values(config.tenantOwners), ...Object.values(config.storeOwners)];
  if (new Set(ids).size !== ids.length) throw new Error("preflight: UUIDs Auth duplicados na configuração");
  const placeholders = ids.map((_, index) => `$${String(index + 1)}::uuid`).join(",");
  const rows = await sql.query(`select id::text from auth.users where id in (${placeholders})`, ids);
  if (rows.length !== ids.length) throw new Error("preflight: um ou mais usuários Auth ainda não existem");
}

export async function runHomologationPreflight(sql: SqlExecutor, config: HomologationRuntimeConfig): Promise<PreflightResult> {
  validateRuntimeConfig(config);
  if (expectedAssets().length !== Object.keys(config.resolvedAssets).length) throw new Error("preflight: manifesto de assets incompleto");
  const [platformPlanId, template] = await Promise.all([
    verifyPlatformPlan(sql, config.platformPlanSlug), verifyTemplate(sql, config.planTemplateCode, config),
  ]);
  await verifyNoForeignCollisions(sql); await verifyDomainCollisions(sql, config); await verifyAuthUsers(sql, config);
  return { platformPlanId, templateId: template.id, entitlementCount: template.count };
}