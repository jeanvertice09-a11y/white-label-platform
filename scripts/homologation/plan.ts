import { assertAllowedCustomHostname, normalizeDomainRegistrationInput } from "@white-label/domains";
import { DEMO_COUNTS, DEMO_STORES, DEMO_TENANTS } from "./fixtures/data.ts";
import type { DemoStore, HomologationRuntimeConfig, ResolvedAsset, StoreKey, TenantKey } from "./model.ts";
import { objectKey, requireStoreDomain } from "./model.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_FEATURES = [
  "products", "variants", "orders", "customers", "inventory", "finance",
  "purchases", "suppliers", "coupons", "campaigns", "banners", "layouts",
] as const;

export interface AssetExpectation {
  key: string;
  storeKey: StoreKey;
  kind: "product" | "banner";
  label: string;
}

export interface HomologationPlan {
  version: string;
  counts: typeof DEMO_COUNTS;
  tenants: readonly { name: string; slug: string; color: string }[];
  stores: readonly { name: string; slug: string; segment: string; layout: string; products: number }[];
  requiredFeatures: readonly string[];
  unsupported: readonly string[];
  productionBlockers: readonly string[];
}

export function expectedAssets(): AssetExpectation[] {
  return DEMO_STORES.flatMap((store) => [
    { key: objectKey(store, "banners/home.webp"), storeKey: store.key, kind: "banner" as const, label: `${store.name} — banner` },
    ...store.products.map((product) => ({
      key: objectKey(store, `products/${product.slug}/primary.webp`),
      storeKey: store.key,
      kind: "product" as const,
      label: `${store.name} — ${product.name}`,
    })),
  ]);
}

export function homologationPlan(): HomologationPlan {
  return {
    version: "kataluu-homologation-v1",
    counts: DEMO_COUNTS,
    tenants: DEMO_TENANTS.map((tenant) => ({ name: tenant.name, slug: tenant.slug, color: tenant.primaryColor })),
    stores: DEMO_STORES.map((store) => ({
      name: store.name, slug: store.slug, segment: store.segment, layout: store.layout, products: store.products.length,
    })),
    requiredFeatures: REQUIRED_FEATURES,
    unsupported: [
      "store logo próprio: não existe campo persistido no schema atual",
      "favicon persistido: não existe campo persistido no schema atual",
      "banner mobile dedicado: store_banners possui somente image_object_key",
      "endereço estruturado de customer: customers não possui coluna de endereço",
    ],
    productionBlockers: [
      "public.plans precisa possuir um plano Kataluu ativo com billing_interval",
      "plan_template_entitlements precisa configurar o template escolhido; o seed nunca inventa a matriz global",
      "6 usuários Auth precisam existir e seus UUIDs devem ser fornecidos fora do Git",
      "12 hostnames controlados precisam estar verificados antes de serem gravados como active",
      "76 assets store-scoped precisam existir no R2 e ter mime/size reais no config resolvido",
      "2 URLs reais de logo das White Labels precisam estar disponíveis",
    ],
  };
}

function assertUuid(label: string, value: string): void {
  if (!UUID_RE.test(value)) throw new Error(`${label}: UUID inválido`);
}

function assertHttps(label: string, value: string): void {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${label}: URL inválida`); }
  if (url.protocol !== "https:") throw new Error(`${label}: use HTTPS`);
}

function assertHostname(label: string, value: string): string {
  const normalized = normalizeDomainRegistrationInput(value);
  assertAllowedCustomHostname(normalized);
  if (normalized !== value) throw new Error(`${label}: hostname deve vir normalizado (${normalized})`);
  return normalized;
}

function validateDomains(config: HomologationRuntimeConfig): void {
  const seen = new Set<string>();
  for (const tenant of DEMO_TENANTS) {
    const domain = config.domains[tenant.key];
    const values = [domain.tenantSite, domain.tenantPanel];
    for (const store of DEMO_STORES.filter((item) => item.tenantKey === tenant.key)) {
      const storeDomain = requireStoreDomain(config, tenant.key, store.key);
      values.push(storeDomain.admin, storeDomain.catalog);
    }
    for (const value of values) {
      const normalized = assertHostname(`domain ${tenant.key}`, value);
      if (seen.has(normalized)) throw new Error(`hostname duplicado: ${normalized}`);
      seen.add(normalized);
    }
  }
}

function validateAssets(config: HomologationRuntimeConfig): void {
  const expected = expectedAssets();
  const expectedKeys = new Set(expected.map((asset) => asset.key));
  for (const asset of expected) {
    const resolved: ResolvedAsset | undefined = config.resolvedAssets[asset.key];
    if (!resolved) throw new Error(`asset ausente no manifesto resolvido: ${asset.key}`);
    if (!Number.isSafeInteger(resolved.sizeBytes) || resolved.sizeBytes <= 0) throw new Error(`asset sem sizeBytes real: ${asset.key}`);
  }
  for (const key of Object.keys(config.resolvedAssets)) {
    if (!expectedKeys.has(key)) throw new Error(`asset inesperado no manifesto resolvido: ${key}`);
  }
}

export function validateRuntimeConfig(config: HomologationRuntimeConfig): void {
  if (!config.platformPlanSlug.trim()) throw new Error("platformPlanSlug obrigatório");
  if (!config.planTemplateCode.trim()) throw new Error("planTemplateCode obrigatório");
  for (const tenant of DEMO_TENANTS) {
    assertUuid(`tenant owner ${tenant.key}`, config.tenantOwners[tenant.key]);
    assertHttps(`tenant logo ${tenant.key}`, config.tenantLogoUrls[tenant.key]);
  }
  for (const store of DEMO_STORES) assertUuid(`store owner ${store.key}`, config.storeOwners[store.key]);
  validateDomains(config);
  validateAssets(config);
  const anchor = Date.parse(config.anchorIso ?? "2026-09-19T12:00:00.000Z");
  if (!Number.isFinite(anchor)) throw new Error("anchorIso inválido");
}

export function requiredFeatureKeys(): readonly string[] { return REQUIRED_FEATURES; }

export function assetStore(key: string): DemoStore {
  const asset = expectedAssets().find((item) => item.key === key);
  if (!asset) throw new Error(`asset desconhecido: ${key}`);
  const store = DEMO_STORES.find((item) => item.key === asset.storeKey);
  if (!store) throw new Error(`store do asset não encontrada: ${asset.storeKey}`);
  return store;
}

export function ownerForStore(config: HomologationRuntimeConfig, key: StoreKey): string { return config.storeOwners[key]; }
export function ownerForTenant(config: HomologationRuntimeConfig, key: TenantKey): string { return config.tenantOwners[key]; }
