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

export interface MerchantBannerInput {
  id?: string;
  objectKey: string;
  title?: string | null;
  subtitle?: string | null;
  linkUrl?: string | null;
  active?: boolean;
  position?: number;
}

export interface CatalogAdminRepository {
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
    input: MerchantCatalogSettingsInput,
  ): Promise<void>;
  upsertBanner(
    scope: CatalogScope,
    input: MerchantBannerInput,
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

export function assertCatalogAdminScope(scope: CatalogScope): void {
  if (!scope.tenantId || !scope.storeId) {
    throw new Error("Admin do catálogo exige tenantId+storeId confiáveis");
  }
}
