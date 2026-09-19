import { PLATFORM_GATEWAY_ID } from "./cleanup.ts";
import { DEMO_STORES, DEMO_TENANTS } from "./fixtures/data.ts";
import type { DemoStore, HomologationRuntimeConfig, SqlExecutor, StoreKey } from "./model.ts";
import { requireStoreDomain, stableUuid, tenantPlanIdFor } from "./model.ts";
import { expectedAssets, requiredFeatureKeysForStore, validateRuntimeConfig } from "./plan.ts";

function text(row: Record<string, unknown> | undefined, key: string): string {
  const value = row?.[key];
  if (typeof value !== "string") throw new Error(`preflight: campo inválido ${key}`);
  return value;
}

function bool(row: Record<string, unknown> | undefined, key: string): boolean { return row?.[key] === true; }

export interface PreflightResult {
  platformPlanId: string;
  templateIds: Record<StoreKey, string>;
  entitlementCounts: Record<StoreKey, number>;
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

function validateTemplateCapacity(rows: Record<string, unknown>[], store: DemoStore, config: HomologationRuntimeConfig): void {
  const features = new Map<string, boolean>();
  const limits = new Map<string, number>();
  for (const row of rows) {
    if (typeof row["key"] !== "string") continue;
    if (row["kind"] === "feature") features.set(row["key"], row["enabled"] === true);
    if (row["kind"] === "limit" && Number.isSafeInteger(Number(row["limit_value"]))) limits.set(row["key"], Number(row["limit_value"]));
  }
  const missing = requiredFeatureKeysForStore(store).filter((key) => features.get(key) !== true);
  if (missing.length > 0) throw new Error(`preflight: template de ${store.key} não habilita: ${missing.join(", ")}`);
  assertLimitCapacity(limits, "max_products", store.products.length, `preflight: max_products de ${store.key} é insuficiente`);
  assertLimitCapacity(limits, "max_stores", 1, `preflight: max_stores de ${store.key} é insuficiente`);
  const assetBytes = expectedAssets()
    .filter((asset) => asset.storeKey === store.key)
    .reduce((sum, asset) => sum + (config.resolvedAssets[asset.key]?.sizeBytes ?? 0), 0);
  assertLimitCapacity(limits, "max_storage_bytes", assetBytes, `preflight: max_storage_bytes de ${store.key} é insuficiente`);
}

async function verifyTemplate(sql: SqlExecutor, store: DemoStore, config: HomologationRuntimeConfig): Promise<{ id: string; count: number }> {
  const code = config.storePlans[store.key].templateCode;
  const rows = await sql.query(
    `select t.id::text,t.active,d.key,d.kind,e.enabled,e.limit_value
     from public.plan_templates t left join public.plan_template_entitlements e on e.template_id=t.id
     left join public.entitlement_definitions d on d.key=e.entitlement_key where t.code=$1 order by d.kind,d.key`, [code],
  );
  if (!rows[0] || !bool(rows[0], "active")) throw new Error(`preflight: template '${code}' inexistente/inativo`);
  validateTemplateCapacity(rows, store, config);
  return { id: text(rows[0], "id"), count: rows.filter((row) => typeof row["key"] === "string").length };
}

async function verifyTenantIdentity(sql: SqlExecutor, tenant: (typeof DEMO_TENANTS)[number]): Promise<void> {
  const byId = await sql.query(`select slug from public.tenants where id=$1::uuid`, [tenant.id]);
  if (byId[0] && byId[0]["slug"] !== tenant.slug) throw new Error(`preflight: ID determinístico pertence a outro tenant: ${tenant.id}`);
  const bySlug = await sql.query(`select id::text from public.tenants where slug=$1`, [tenant.slug]);
  if (bySlug[0] && text(bySlug[0], "id") !== tenant.id) throw new Error(`preflight: slug ocupado por outro tenant: ${tenant.slug}`);
}

async function verifyStoreIdentity(sql: SqlExecutor, store: DemoStore): Promise<void> {
  const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
  if (!tenant) throw new Error(`preflight: tenant ausente para ${store.key}`);
  const byId = await sql.query(`select tenant_id::text,slug from public.stores where id=$1::uuid`, [store.id]);
  if (byId[0] && (byId[0]["tenant_id"] !== tenant.id || byId[0]["slug"] !== store.slug)) {
    throw new Error(`preflight: ID determinístico pertence a outra store: ${store.id}`);
  }
  const bySlug = await sql.query(`select id::text from public.stores where tenant_id=$1::uuid and slug=$2`, [tenant.id, store.slug]);
  if (bySlug[0] && text(bySlug[0], "id") !== store.id) throw new Error(`preflight: slug ocupado por outra store: ${store.slug}`);
}

async function verifyTenantPlanIdentity(sql: SqlExecutor, store: DemoStore, config: HomologationRuntimeConfig): Promise<void> {
  const plan = config.storePlans[store.key];
  const id = tenantPlanIdFor(store.tenantKey, plan.templateCode);
  const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
  if (!tenant) throw new Error(`preflight: tenant ausente para plano ${store.key}`);
  const rows = await sql.query(`select tenant_id::text,slug from public.tenant_plans where id=$1::uuid`, [id]);
  const row = rows[0];
  if (row && (row["tenant_id"] !== tenant.id || row["slug"] !== plan.slug)) {
    throw new Error(`preflight: ID determinístico pertence a outro tenant_plan: ${id}`);
  }
  const bySlug = await sql.query(`select id::text from public.tenant_plans where tenant_id=$1::uuid and slug=$2`, [tenant.id, plan.slug]);
  if (bySlug[0] && text(bySlug[0], "id") !== id) throw new Error(`preflight: slug de tenant_plan ocupado: ${plan.slug}`);
}

async function verifyGatewayIdentity(sql: SqlExecutor): Promise<void> {
  const rows = await sql.query(
    `select level,tenant_id::text,store_id::text,public_identifier
     from public.gateway_accounts where id=$1::uuid`, [PLATFORM_GATEWAY_ID],
  );
  const row = rows.at(0);
  if (!row) return;
  if (row["level"] !== "platform_billing" || row["tenant_id"] !== null || row["store_id"] !== null || row["public_identifier"] !== "hml-internal-only") {
    throw new Error(`preflight: ID determinístico do gateway pertence a outro registro: ${PLATFORM_GATEWAY_ID}`);
  }
}

async function verifyNoForeignCollisions(sql: SqlExecutor, config: HomologationRuntimeConfig): Promise<void> {
  for (const tenant of DEMO_TENANTS) await verifyTenantIdentity(sql, tenant);
  for (const store of DEMO_STORES) {
    await verifyStoreIdentity(sql, store);
    await verifyTenantPlanIdentity(sql, store, config);
  }
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

function expectedAuth(config: HomologationRuntimeConfig): Map<string, { email: string; tenantId: string | null; storeId: string | null }> {
  const expected = new Map<string, { email: string; tenantId: string | null; storeId: string | null }>();
  for (const tenant of DEMO_TENANTS) {
    expected.set(config.tenantOwners[tenant.key], { email: config.tenantOwnerEmails[tenant.key], tenantId: tenant.id, storeId: null });
  }
  for (const store of DEMO_STORES) {
    const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
    if (!tenant) throw new Error(`preflight: tenant ausente para Auth ${store.key}`);
    expected.set(config.storeOwners[store.key], { email: config.storeOwnerEmails[store.key], tenantId: tenant.id, storeId: store.id });
  }
  return expected;
}

async function verifyAuthMembershipScope(sql: SqlExecutor, expected: Map<string, { email: string; tenantId: string | null; storeId: string | null }>): Promise<void> {
  const ids = [...expected.keys()];
  const placeholders = ids.map((_, index) => `$${String(index + 1)}::uuid`).join(",");
  const tenantRows = await sql.query(`select tenant_id::text,user_id::text,role from public.tenant_members where user_id in (${placeholders})`, ids);
  for (const row of tenantRows) {
    const user = expected.get(text(row, "user_id"));
    if (!user || user.storeId !== null || row["tenant_id"] !== user.tenantId || row["role"] !== "tenant_owner") {
      throw new Error("preflight: membership Auth fora do tenant esperado");
    }
  }
  const storeRows = await sql.query(`select tenant_id::text,store_id::text,user_id::text,role from public.store_members where user_id in (${placeholders})`, ids);
  for (const row of storeRows) {
    const user = expected.get(text(row, "user_id"));
    if (!user || user.storeId === null || row["tenant_id"] !== user.tenantId || row["store_id"] !== user.storeId || row["role"] !== "store_owner") {
      throw new Error("preflight: membership Auth fora da store esperada");
    }
  }
}

async function verifyAuthUsers(sql: SqlExecutor, config: HomologationRuntimeConfig): Promise<void> {
  const exists = await sql.query(`select to_regclass('auth.users')::text as table_name`);
  if (!exists[0]?.["table_name"]) throw new Error("preflight: auth.users indisponível; validação Auth é obrigatória");
  const expected = expectedAuth(config);
  if (expected.size !== 6) throw new Error("preflight: UUIDs Auth duplicados na configuração");
  const ids = [...expected.keys()];
  const placeholders = ids.map((_, index) => `$${String(index + 1)}::uuid`).join(",");
  const rows = await sql.query(`select id::text,email from auth.users where id in (${placeholders})`, ids);
  if (rows.length !== ids.length) throw new Error("preflight: um ou mais usuários Auth ainda não existem");
  for (const row of rows) {
    const user = expected.get(text(row, "id"));
    if (!user || String(row["email"] ?? "").toLowerCase() !== user.email.toLowerCase()) {
      throw new Error(`preflight: email Auth divergente para ${text(row, "id")}`);
    }
  }
  await verifyAuthMembershipScope(sql, expected);
}

export async function runHomologationPreflight(sql: SqlExecutor, config: HomologationRuntimeConfig): Promise<PreflightResult> {
  validateRuntimeConfig(config);
  if (expectedAssets().length !== Object.keys(config.resolvedAssets).length) throw new Error("preflight: manifesto de assets incompleto");
  const platformPlanId = await verifyPlatformPlan(sql, config.platformPlanSlug);
  const templateIds = {} as Record<StoreKey, string>;
  const entitlementCounts = {} as Record<StoreKey, number>;
  for (const store of DEMO_STORES) {
    const template = await verifyTemplate(sql, store, config);
    templateIds[store.key] = template.id;
    entitlementCounts[store.key] = template.count;
  }
  await verifyNoForeignCollisions(sql, config);
  await verifyDomainCollisions(sql, config);
  await verifyAuthUsers(sql, config);
  return { platformPlanId, templateIds, entitlementCounts };
}
