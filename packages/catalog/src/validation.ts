import type { CatalogSettings, Category, Product } from "./types.ts";

const HEX = /^#[0-9a-f]{6}$/i;
const SAFE_TEXT = /^[^<>]*$/;
const SAFE_FONTS = new Set(["system", "inter", "serif", "sans"]);

function assertText(value: string, label: string, max: number): void {
  const text = value.trim();
  if (!text || text.length > max || !SAFE_TEXT.test(text)) {
    throw new Error(`${label} inválido`);
  }
}

function assertOptionalText(value: string | null, label: string, max: number): void {
  if (value === null) return;
  if (value.length > max || !SAFE_TEXT.test(value)) throw new Error(`${label} inválido`);
}

export function assertCatalogSettings(settings: CatalogSettings): void {
  if (!HEX.test(settings.primaryColor) || !HEX.test(settings.accentColor) || !HEX.test(settings.backgroundColor)) {
    throw new Error("Cor inválida");
  }
  if (!SAFE_FONTS.has(settings.fontFamily)) throw new Error("Fonte inválida");
  if (!["classic", "modern"].includes(settings.layout)) throw new Error("Layout inválido");
  if (!["whatsapp", "online", "both"].includes(settings.checkoutMode)) {
    throw new Error("Checkout inválido");
  }
  assertText(settings.whatsappMessage, "Mensagem do WhatsApp", 500);
  assertOptionalText(settings.seoTitle, "SEO title", 120);
  assertOptionalText(settings.seoDescription, "SEO description", 320);
  for (const [key, value] of Object.entries(settings.labels)) {
    if (!/^[a-z0-9_-]{1,40}$/i.test(key) || value.length > 120 || !SAFE_TEXT.test(value)) {
      throw new Error("Label inválida");
    }
  }
}

export function assertProductInput(product: Pick<Product, "name" | "slug" | "priceCents" | "compareAtPriceCents" | "costCents">): void {
  assertText(product.name, "Nome", 160);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) throw new Error("Slug inválido");
  if (!Number.isInteger(product.priceCents) || product.priceCents < 0) throw new Error("Preço inválido");
  if (product.compareAtPriceCents !== null && (!Number.isInteger(product.compareAtPriceCents) || product.compareAtPriceCents < 0)) {
    throw new Error("Preço comparativo inválido");
  }
  if (product.costCents !== null && (!Number.isInteger(product.costCents) || product.costCents < 0)) {
    throw new Error("Custo inválido");
  }
}

export function assertCategoryInput(category: Pick<Category, "name" | "slug">): void {
  assertText(category.name, "Categoria", 120);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug)) throw new Error("Slug inválido");
}
