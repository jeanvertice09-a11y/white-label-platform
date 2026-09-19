import { createHash } from "node:crypto";

export type DemoLayout = "classic" | "modern";
export type StoreKey = "lume" | "botanica" | "passo" | "casa";
export type TenantKey = "aurora" | "nexo";
export type BillingInterval = "monthly" | "quarterly" | "yearly";
export type HmlTemplateCode = "monthly_entry" | "monthly_intermediate" | "monthly_complete" | "complete";

export interface SqlExecutor {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  execScript?(sql: string): Promise<void>;
}

export interface StoreDomainConfig {
  admin: string;
  catalog: string;
}

export interface DomainConfig {
  tenantSite: string;
  tenantPanel: string;
  stores: Partial<Record<StoreKey, StoreDomainConfig>>;
}

export interface TenantPlanRuntimeConfig {
  templateCode: HmlTemplateCode;
  slug: string;
  name: string;
  priceCents: number | null;
  billingInterval: BillingInterval | null;
  trialEnabled: boolean | null;
  trialDays: number | null;
}

export interface ResolvedAsset {
  source: string;
  mimeType: "image/webp" | "image/jpeg" | "image/png";
  sizeBytes: number;
  sha256: string;
  storeKey: StoreKey;
  kind: "product" | "banner";
  productSlug: string | null;
}

export interface HomologationRuntimeConfig {
  platformPlanSlug: string;
  platformBillingAmountCents: Record<TenantKey, number | null>;
  storePlans: Record<StoreKey, TenantPlanRuntimeConfig>;
  tenantOwners: Record<TenantKey, string>;
  storeOwners: Record<StoreKey, string>;
  tenantOwnerEmails: Record<TenantKey, string>;
  storeOwnerEmails: Record<StoreKey, string>;
  tenantLogoUrls: Record<TenantKey, string>;
  domains: Record<TenantKey, DomainConfig>;
  mediaOrigin: string;
  assetManifestFile?: string;
  resolvedAssets: Partial<Record<string, ResolvedAsset>>;
  anchorIso?: string;
}

export interface DemoVariant {
  id: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number;
  initialStock: number;
}

export interface DemoProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  categoryKey: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number;
  initialStock: number;
  variants: DemoVariant[];
}

export interface DemoCategory {
  key: string;
  id: string;
  name: string;
  slug: string;
  parentKey: string | null;
  position: number;
}

export interface DemoStore {
  key: StoreKey;
  tenantKey: TenantKey;
  id: string;
  name: string;
  slug: string;
  segment: string;
  description: string;
  layout: DemoLayout;
  primaryColor: string;
  accentColor: string;
  whatsapp: string;
  categories: DemoCategory[];
  products: DemoProduct[];
}

export interface DemoTenant {
  key: TenantKey;
  id: string;
  name: string;
  slug: string;
  companyName: string;
  primaryColor: string;
}

export const SEED_VERSION = "kataluu-homologation-v1";
export const DEFAULT_ANCHOR_ISO = "2026-09-19T12:00:00.000Z";

export function stableUuid(key: string): string {
  const hex = createHash("sha256").update(`${SEED_VERSION}:${key}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function isoDaysFrom(anchorIso: string, days: number): string {
  const time = new Date(anchorIso).getTime() + days * 86_400_000;
  return new Date(time).toISOString();
}

export function isoDate(iso: string): string {
  return iso.slice(0, 10);
}

export function tenantIdFor(key: TenantKey): string {
  return stableUuid(`tenant:${key}`);
}

export function storeIdFor(key: StoreKey): string {
  return stableUuid(`store:${key}`);
}

export function tenantPlanIdFor(tenantKey: TenantKey, templateCode: HmlTemplateCode): string {
  return stableUuid(`tenant-plan:${tenantKey}:${templateCode}`);
}

export function objectKey(store: DemoStore, purpose: string): string {
  return `tenants/${tenantIdFor(store.tenantKey)}/stores/${store.id}/${purpose}`;
}

export function requireStoreDomain(
  config: HomologationRuntimeConfig,
  tenantKey: TenantKey,
  storeKey: StoreKey,
): StoreDomainConfig {
  const value = config.domains[tenantKey].stores[storeKey];
  if (!value) throw new Error(`domínios ausentes para ${tenantKey}/${storeKey}`);
  return value;
}

export function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function uuidSql(value: string | null): string {
  return value === null ? "null" : `${quoteSql(value)}::uuid`;
}
