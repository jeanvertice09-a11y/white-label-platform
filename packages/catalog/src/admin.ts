import type { CatalogScope } from "./types.ts";
import type {
  CatalogFontKey,
  CatalogLayout,
  CheckoutMode,
} from "./storefront.ts";

export interface MerchantProductInput {
  name: string;
  slug?: string;
  categoryId?: string | null;
  description?: string;
  sku?: string | null;
  priceCents: number;
  compareAtPriceCents?: number | null;
  costCents?: number | null;
  active?: boolean;
  trackInventory?: boolean;
}

export interface NormalizedMerchantProductInput {
  name: string;
  slug: string;
  categoryId: string | null;
  description: string;
  sku: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  active: boolean;
  trackInventory: boolean;
}

export interface MerchantVariantInput {
  id?: string;
  name: string;
  sku?: string | null;
  attributes?: Record<string, string>;
  priceCents: number;
  compareAtPriceCents?: number | null;
  costCents?: number | null;
  active?: boolean;
  position?: number;
}

export interface NormalizedMerchantVariantInput {
  id?: string;
  name: string;
  sku: string | null;
  attributes: Record<string, string>;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  active: boolean;
  position: number;
}

export interface MerchantCategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  active?: boolean;
  position?: number;
}

export interface NormalizedMerchantCategoryInput {
  name: string;
  slug: string;
  parentId: string | null;
  active: boolean;
  position: number;
}

export interface MerchantCatalogSettingsInput {
  layout?: CatalogLayout;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontKey?: CatalogFontKey;
  showSearch?: boolean;
  showCategories?: boolean;
  showStock?: boolean;
  showPrices?: boolean;
  checkoutMode?: CheckoutMode;
  whatsappPhone?: string | null;
  whatsappMessageTemplate?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  labels?: Record<string, string>;
}

export interface NormalizedMerchantCatalogSettingsInput {
  layout: CatalogLayout;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontKey: CatalogFontKey;
  showSearch: boolean;
  showCategories: boolean;
  showStock: boolean;
  showPrices: boolean;
  checkoutMode: CheckoutMode;
  whatsappPhone: string | null;
  whatsappMessageTemplate: string;
  seoTitle: string | null;
  seoDescription: string | null;
  labels: Record<string, string>;
}

export interface MerchantBannerInput {
  id?: string;
  objectKey: string;
  title?: string | null;
  subtitle?: string | null;
  linkUrl?: string | null;
  active?: boolean;
  position?: number;
}

export interface NormalizedMerchantBannerInput {
  id?: string;
  objectKey: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  active: boolean;
  position: number;
}

export interface MerchantAdminProduct {
  id: string;
  categoryId: string | null;
  name: string;
  slug: string;
  sku: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  active: boolean;
  trackInventory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantAdminCategory {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  active: boolean;
  position: number;
}

export interface MerchantAdminBanner {
  id: string;
  objectKey: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  active: boolean;
  position: number;
}

export interface MerchantCatalogAdminSnapshot {
  products: MerchantAdminProduct[];
  categories: MerchantAdminCategory[];
  banners: MerchantAdminBanner[];
  settings: NormalizedMerchantCatalogSettingsInput;
}

export interface CatalogAdminRepository {
  getSnapshot(scope: CatalogScope): Promise<MerchantCatalogAdminSnapshot>;
  createProduct(
    scope: CatalogScope,
    input: NormalizedMerchantProductInput,
  ): Promise<string>;
  updateProduct(
    scope: CatalogScope,
    productId: string,
    input: NormalizedMerchantProductInput,
  ): Promise<void>;
  setProductActive(
    scope: CatalogScope,
    productId: string,
    active: boolean,
  ): Promise<void>;
  replaceProductVariants(
    scope: CatalogScope,
    productId: string,
    variants: NormalizedMerchantVariantInput[],
  ): Promise<void>;
  createCategory(
    scope: CatalogScope,
    input: NormalizedMerchantCategoryInput,
  ): Promise<string>;
  updateCategory(
    scope: CatalogScope,
    categoryId: string,
    input: NormalizedMerchantCategoryInput,
  ): Promise<void>;
  upsertSettings(
    scope: CatalogScope,
    input: NormalizedMerchantCatalogSettingsInput,
  ): Promise<void>;
  upsertBanner(
    scope: CatalogScope,
    input: NormalizedMerchantBannerInput,
  ): Promise<string>;
  deleteBanner(scope: CatalogScope, bannerId: string): Promise<void>;
}

function requiredText(value: string, field: string, max: number): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} é obrigatório`);
  if (normalized.length > max) throw new Error(`${field} muito longo`);
  return normalized;
}

function optionalText(
  value: string | null | undefined,
  max: number,
): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized.length > max) throw new Error("Texto muito longo");
  return normalized;
}

function money(value: number | null | undefined, field: string): number | null {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} inválido`);
  }
  return value;
}

function position(value: number | undefined): number {
  const normalized = value ?? 0;
  if (!Number.isInteger(normalized) || normalized < 0 || normalized > 100000) {
    throw new Error("Posição inválida");
  }
  return normalized;
}

export function slugifyCatalogName(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  if (!slug) throw new Error("Slug inválido");
  return slug;
}

export function normalizeMerchantProductInput(
  input: MerchantProductInput,
): NormalizedMerchantProductInput {
  const name = requiredText(input.name, "Nome", 180);
  const priceCents = money(input.priceCents, "Preço");
  if (priceCents == null) throw new Error("Preço é obrigatório");

  return {
    name,
    slug: slugifyCatalogName(input.slug ?? name),
    categoryId: input.categoryId ?? null,
    description: input.description?.trim().slice(0, 12000) ?? "",
    sku: optionalText(input.sku, 120),
    priceCents,
    compareAtPriceCents: money(input.compareAtPriceCents, "Preço comparativo"),
    costCents: money(input.costCents, "Custo"),
    active: input.active ?? true,
    trackInventory: input.trackInventory ?? false,
  };
}

export function normalizeMerchantVariantInput(
  input: MerchantVariantInput,
): NormalizedMerchantVariantInput {
  const name = requiredText(input.name, "Nome da variante", 160);
  const priceCents = money(input.priceCents, "Preço da variante");
  if (priceCents == null) throw new Error("Preço da variante é obrigatório");

  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.attributes ?? {})) {
    const normalizedKey = key.trim();
    const normalizedValue = value.trim();
    if (!normalizedKey || !normalizedValue) continue;
    if (normalizedKey.length > 60 || normalizedValue.length > 120) {
      throw new Error("Atributo de variante muito longo");
    }
    attributes[normalizedKey] = normalizedValue;
  }

  return {
    id: input.id,
    name,
    sku: optionalText(input.sku, 120),
    attributes,
    priceCents,
    compareAtPriceCents: money(
      input.compareAtPriceCents,
      "Preço comparativo da variante",
    ),
    costCents: money(input.costCents, "Custo da variante"),
    active: input.active ?? true,
    position: position(input.position),
  };
}

export function normalizeMerchantCategoryInput(
  input: MerchantCategoryInput,
): NormalizedMerchantCategoryInput {
  const name = requiredText(input.name, "Nome da categoria", 160);
  return {
    name,
    slug: slugifyCatalogName(input.slug ?? name),
    parentId: input.parentId ?? null,
    active: input.active ?? true,
    position: position(input.position),
  };
}

function color(value: string | undefined, fallback: string): string {
  const normalized = value?.trim() || fallback;
  if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
    throw new Error("Cor inválida");
  }
  return normalized.toLowerCase();
}

function safeLink(value: string | null | undefined): string | null {
  const normalized = optionalText(value, 2048);
  if (!normalized) return null;
  if (normalized.startsWith("/")) return normalized;
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Link do banner inválido");
  }
  if (url.protocol !== "https:") {
    throw new Error("Link do banner deve usar HTTPS");
  }
  return url.toString();
}

function normalizeLabels(input: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    const k = key.trim();
    const v = value.trim();
    if (!k || !v) continue;
    if (k.length > 80 || v.length > 160) throw new Error("Label muito longa");
    out[k] = v;
  }
  return out;
}

/**
 * Snapshot completo das configurações do catálogo.
 * A tela de aparência deve carregar o estado atual, editar e enviar o snapshot.
 */
export function normalizeMerchantCatalogSettingsInput(
  input: MerchantCatalogSettingsInput,
): NormalizedMerchantCatalogSettingsInput {
  const whatsappPhone = optionalText(input.whatsappPhone, 20);
  if (whatsappPhone && !/^\+[1-9][0-9]{7,14}$/.test(whatsappPhone)) {
    throw new Error("WhatsApp inválido; use formato +5511999999999");
  }

  return {
    layout: input.layout ?? "classic",
    primaryColor: color(input.primaryColor, "#111111"),
    accentColor: color(input.accentColor, "#111111"),
    backgroundColor: color(input.backgroundColor, "#ffffff"),
    fontKey: input.fontKey ?? "system",
    showSearch: input.showSearch ?? true,
    showCategories: input.showCategories ?? true,
    showStock: input.showStock ?? false,
    showPrices: input.showPrices ?? true,
    checkoutMode: input.checkoutMode ?? "whatsapp",
    whatsappPhone,
    whatsappMessageTemplate:
      requiredText(
        input.whatsappMessageTemplate ?? "Olá! Gostaria de fazer este pedido:",
        "Mensagem do WhatsApp",
        1000,
      ),
    seoTitle: optionalText(input.seoTitle, 160),
    seoDescription: optionalText(input.seoDescription, 320),
    labels: normalizeLabels(input.labels),
  };
}

export function normalizeMerchantBannerInput(
  scope: CatalogScope,
  input: MerchantBannerInput,
): NormalizedMerchantBannerInput {
  const objectKey = requiredText(input.objectKey, "Imagem do banner", 500);
  const expectedPrefix = `tenants/${scope.tenantId.toLowerCase()}/stores/${scope.storeId.toLowerCase()}/`;
  if (!objectKey.toLowerCase().startsWith(expectedPrefix)) {
    throw new Error("Imagem do banner fora do escopo da loja");
  }

  return {
    id: input.id,
    objectKey,
    title: optionalText(input.title, 180),
    subtitle: optionalText(input.subtitle, 320),
    linkUrl: safeLink(input.linkUrl),
    active: input.active ?? true,
    position: position(input.position),
  };
}

export function assertCatalogAdminScope(scope: CatalogScope): void {
  if (!scope.tenantId || !scope.storeId) {
    throw new Error("Admin do catálogo exige tenantId+storeId confiáveis");
  }
}
