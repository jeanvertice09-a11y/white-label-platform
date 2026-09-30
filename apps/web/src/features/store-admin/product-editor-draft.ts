import type { Product, ProductVariant } from "@white-label/catalog";
import type { ProductEditorInput } from "../../lib/server/product-editor.schema.ts";
import { centsToInput, moneyToCents, slugify } from "./format.ts";
export interface ProductDraft {
  name: string; slug: string; description: string; categoryIds: string[]; price: string; promotion: string;
  cost: string; sku: string; barcode: string; stock: string; position: string; active: boolean;
  featured: boolean; hasVariants: boolean; pixDiscount: string;
}
export interface VariantDraft { key: string; id?: string; name: string; sku: string; attributes: Record<string,string>;
  price: string; promotion: string; cost: string; stock: string; active: boolean; expectedStockQuantity?: number; }
export function variantKey(attributes: Record<string,string>): string {
  return JSON.stringify(Object.entries(attributes).sort(([a],[b]) => a.localeCompare(b)));
}
export function initialProductDraft(p: Product | null): ProductDraft {
  const promo = p?.compareAtPriceCents;
  return { name: p?.name ?? "", slug: p?.slug ?? "", description: p?.description ?? "", categoryIds: p?.categoryIds ?? [],
    price: p ? centsToInput(promo ?? p.priceCents) : "", promotion: promo ? centsToInput(p.priceCents) : "",
    cost: centsToInput(p?.costCents ?? null), sku: p?.sku ?? "", barcode: p?.barcode ?? "", stock: String(p?.stockQuantity ?? 0),
    position: String(p?.position ?? 0), active: p?.active ?? true, featured: p?.featured ?? false,
    hasVariants: Boolean(p?.variants.length), pixDiscount: String(p?.pixDiscountPercent ?? 0) };
}
export function initialVariantDraft(v: ProductVariant): VariantDraft {
  return { key: v.id, id: v.id, name: v.name, sku: v.sku ?? "", attributes: v.attributes,
    price: centsToInput(v.compareAtPriceCents ?? v.priceCents), promotion: v.compareAtPriceCents ? centsToInput(v.priceCents) : "",
    cost: centsToInput(v.costCents), stock: String(v.stockQuantity), active: v.active, expectedStockQuantity: v.stockQuantity };
}
function integer(value: string, label: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > 1_000_000) throw new Error(`${label} inválido`);
  return n;
}
function prices(price: string, promotion: string) {
  if (!price.trim()) throw new Error("Informe o preço do produto.");
  const base = moneyToCents(price), promo = promotion.trim() ? moneyToCents(promotion) : null;
  if (promo !== null && promo >= base) throw new Error("O preço promocional precisa ser menor que o preço normal.");
  return { priceCents: promo ?? base, compareAtPriceCents: promo === null ? null : base };
}
export function productEditorInput(d: ProductDraft, variants: VariantDraft[], original: Product | null): ProductEditorInput {
  if (!d.name.trim()) throw new Error("Informe o nome do produto.");
  if (d.hasVariants && !variants.length) throw new Error("Adicione os tamanhos, cores ou opções do produto.");
  if (!d.hasVariants && original?.variants.length) throw new Error("Este produto já tem opções. Edite as quantidades de cada opção.");
  const pix = Number(d.pixDiscount);
  if (!Number.isFinite(pix) || pix < 0 || pix > 100) throw new Error("Desconto no Pix inválido.");
  return { photos: [], id: original?.id, expectedStockQuantity: original?.stockQuantity,
    input: { name: d.name.trim(), slug: slugify(d.slug || d.name), description: d.description.trim() || null,
      sku: d.sku.trim() || null, barcode: d.barcode.trim() || null, featured: d.featured,
      categoryId: d.categoryIds[0] ?? null, categoryIds: d.categoryIds, ...prices(d.price,d.promotion),
      costCents: d.cost.trim() ? moneyToCents(d.cost) : null, discountType: original?.discountType ?? null,
      discountValue: original?.discountValue ?? null, pixDiscountPercent: pix, freeShipping: original?.freeShipping ?? false,
      active: d.active, trackInventory: true, stockQuantity: integer(d.stock,"Estoque"), position: integer(d.position,"Ordem") },
    variants: d.hasVariants ? variants.map((v,index) => ({ id: v.id, name: v.name, sku: v.sku.trim() || null,
      attributes: v.attributes, ...prices(v.price || d.price,v.promotion), costCents: v.cost.trim() ? moneyToCents(v.cost) : null,
      stockQuantity: integer(v.stock,"Estoque da opção"), expectedStockQuantity: v.expectedStockQuantity, active: v.active, position: index })) : [] };
}
