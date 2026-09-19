import { assertAllowedCustomHostname, normalizeDomainRegistrationInput } from "@white-label/domains";
import { DEMO_COUNTS, DEMO_STORES, DEMO_TENANTS } from "./fixtures/data.ts";
import type {
  DemoStore,
  HmlTemplateCode,
  HomologationMediaMode,
  HomologationRuntimeConfig,
  ResolvedAsset,
  StoreKey,
  TenantKey,
} from "./model.ts";
import { objectKey, requireStoreDomain } from "./model.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;
const PLAN_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_MIME = new Set(["image/webp", "image/jpeg", "image/png"]);
export const HML_MEDIA_ORIGIN = "https://media.kataluu.com.br";

export const EXPECTED_STORE_TEMPLATES: Readonly<Record<StoreKey, HmlTemplateCode>> = {
  lume: "monthly_entry",
  botanica: "monthly_intermediate",
  passo: "monthly_complete",
  casa: "complete",
};

const BASE_REQUIRED_FEATURES = ["products", "variants", "orders", "customers", "banners"] as const;

export interface AssetExpectation {
  key: string;
  storeKey: StoreKey;
  kind: "product" | "banner";
  label: string;
  productSlug: string | null;
}

export interface HomologationPlan {
  version: string;
  counts: typeof DEMO_COUNTS;
  tenants: readonly { name: string; slug: string; color: string }[];
  stores: readonly { name: string; slug: string; segment: string; layout: string; products: number; templateCode: HmlTemplateCode }[];
  productionBlockers: readonly string[];
}

export interface RuntimeValidationOptions {
  mediaMode?: HomologationMediaMode;
}

export function expectedAssets(): AssetExpectation[] {
  return DEMO_STORES.flatMap((store) => [
    {
      key: objectKey(store, "banners/home.webp"),
      storeKey: store.key,
      kind: "banner" as const,
      label: `${store.name} — banner`,
      productSlug: null,
    },
    ...store.products.map((product) => ({
      key: objectKey(store, `products/${product.slug}/primary.webp`),
      storeKey: store.key,
      kind: "product" as const,
      label: `${store.name} — ${product.name}`,
      productSlug: product.slug,
    })),
  ]);
}

export function homologationPlan(): HomologationPlan {
  return {
    version: "kataluu-homologation-v1",
    counts: DEMO_COUNTS,
    tenants: DEMO_TENANTS.map((tenant) => ({ name: tenant.name, slug: tenant.slug, color: tenant.primaryColor })),
    stores: DEMO_STORES.map((store) => ({
      name: store.name,
      slug: store.slug,
      segment: store.segment,
      layout: store.layout,
      products: store.products.length,
      templateCode: EXPECTED_STORE_TEMPLATES[store.key],
    })),
    productionBlockers: [
      "public.plans precisa possuir um plano Kataluu ativo com billing_interval",
      "preço, billing interval e trial dos quatro tenant_plans precisam estar explícitos no config privado",
      "6 usuários Auth precisam existir e seus UUIDs/emails devem corresponder ao config privado",
      "12 hostnames controlados precisam estar verificados antes de serem gravados como active",
      "76 assets únicos precisam existir no media origin com size e SHA-256 do manifesto para readiness completa de mídia",
      "2 URLs HTTPS reais de logo das White Labels precisam estar publicadas para readiness completa de mídia",
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

function assertEmail(label: string, value: string): void {
  if (!EMAIL_RE.test(value)) throw new Error(`${label}: email inválido`);
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

function validateStorePlans(config: HomologationRuntimeConfig): void {
  for (const store of DEMO_STORES) {
    const plan = config.storePlans[store.key];
    if (plan.templateCode !== EXPECTED_STORE_TEMPLATES[store.key]) {
      throw new Error(`storePlans.${store.key}.templateCode deve ser ${EXPECTED_STORE_TEMPLATES[store.key]}`);
    }
    if (!PLAN_SLUG_RE.test(plan.slug)) throw new Error(`storePlans.${store.key}.slug inválido`);
    if (!plan.name.trim()) throw new Error(`storePlans.${store.key}.name obrigatório`);
    if (!Number.isSafeInteger(plan.priceCents) || Number(plan.priceCents) < 0) {
      throw new Error(`storePlans.${store.key}.priceCents obrigatório`);
    }
    if (!plan.billingInterval) throw new Error(`storePlans.${store.key}.billingInterval obrigatório`);
    if (typeof plan.trialEnabled !== "boolean") throw new Error(`storePlans.${store.key}.trialEnabled obrigatório`);
    if (!Number.isSafeInteger(plan.trialDays)) throw new Error(`storePlans.${store.key}.trialDays obrigatório`);
    const trialDays = Number(plan.trialDays);
    if (plan.trialEnabled ? trialDays < 1 || trialDays > 365 : trialDays !== 0) {
      throw new Error(`storePlans.${store.key}: configuração de trial inválida`);
    }
  }
}

function assertAssetMatchesExpectation(asset: AssetExpectation, resolved: ResolvedAsset): void {
  if (resolved.storeKey !== asset.storeKey || resolved.kind !== asset.kind || resolved.productSlug !== asset.productSlug) {
    throw new Error(`asset com associação divergente: ${asset.key}`);
  }
  if (!resolved.source.trim()) throw new Error(`asset sem source: ${asset.key}`);
  if (!IMAGE_MIME.has(resolved.mimeType)) throw new Error(`asset com MIME inválido: ${asset.key}`);
  if (!Number.isSafeInteger(resolved.sizeBytes) || resolved.sizeBytes <= 0) throw new Error(`asset sem sizeBytes real: ${asset.key}`);
  if (!SHA256_RE.test(resolved.sha256)) throw new Error(`asset com sha256 inválido: ${asset.key}`);
}

function validateAssets(config: HomologationRuntimeConfig): void {
  const expected = expectedAssets();
  const expectedKeys = new Set(expected.map((asset) => asset.key));
  const hashes = new Set<string>();
  for (const asset of expected) {
    const resolved: ResolvedAsset | undefined = config.resolvedAssets[asset.key];
    if (!resolved) throw new Error(`asset ausente no manifesto resolvido: ${asset.key}`);
    assertAssetMatchesExpectation(asset, resolved);
    const hash = resolved.sha256.toLowerCase();
    if (hashes.has(hash)) throw new Error(`asset duplicado por conteúdo (sha256): ${asset.key}`);
    hashes.add(hash);
  }
  for (const key of Object.keys(config.resolvedAssets)) {
    if (!expectedKeys.has(key)) throw new Error(`asset inesperado no manifesto resolvido: ${key}`);
  }
}

function validateOwners(config: HomologationRuntimeConfig, mediaMode: HomologationMediaMode): void {
  for (const tenant of DEMO_TENANTS) {
    assertUuid(`tenant owner ${tenant.key}`, config.tenantOwners[tenant.key]);
    assertEmail(`tenant owner email ${tenant.key}`, config.tenantOwnerEmails[tenant.key]);
    if (mediaMode === "required") assertHttps(`tenant logo ${tenant.key}`, config.tenantLogoUrls[tenant.key]);
  }
  for (const store of DEMO_STORES) {
    assertUuid(`store owner ${store.key}`, config.storeOwners[store.key]);
    assertEmail(`store owner email ${store.key}`, config.storeOwnerEmails[store.key]);
  }
}

export function validateRuntimeConfig(
  config: HomologationRuntimeConfig,
  options: RuntimeValidationOptions = {},
): void {
  const mediaMode = options.mediaMode ?? "required";
  if (!config.platformPlanSlug.trim()) throw new Error("platformPlanSlug obrigatório");
  for (const tenant of DEMO_TENANTS) {
    const amount = config.platformBillingAmountCents[tenant.key];
    if (!Number.isSafeInteger(amount) || Number(amount) < 0) throw new Error(`platformBillingAmountCents.${tenant.key} obrigatório`);
  }
  validateStorePlans(config);
  validateOwners(config, mediaMode);
  validateDomains(config);
  if (mediaMode === "required") {
    assertHttps("mediaOrigin", config.mediaOrigin);
    if (config.mediaOrigin.replace(/\/$/, "") !== HML_MEDIA_ORIGIN) throw new Error(`mediaOrigin deve ser ${HML_MEDIA_ORIGIN}`);
    validateAssets(config);
  }
  const anchor = Date.parse(config.anchorIso ?? "2026-09-19T12:00:00.000Z");
  if (!Number.isFinite(anchor)) throw new Error("anchorIso inválido");
}

export function requiredFeatureKeysForStore(store: DemoStore): readonly string[] {
  return store.layout === "modern" ? [...BASE_REQUIRED_FEATURES, "layouts"] : BASE_REQUIRED_FEATURES;
}

export function assetStore(key: string): DemoStore {
  const asset = expectedAssets().find((item) => item.key === key);
  if (!asset) throw new Error(`asset desconhecido: ${key}`);
  const store = DEMO_STORES.find((item) => item.key === asset.storeKey);
  if (!store) throw new Error(`store do asset não encontrada: ${asset.storeKey}`);
  return store;
}

export function ownerForStore(config: HomologationRuntimeConfig, key: StoreKey): string { return config.storeOwners[key]; }
export function ownerForTenant(config: HomologationRuntimeConfig, key: TenantKey): string { return config.tenantOwners[key]; }
