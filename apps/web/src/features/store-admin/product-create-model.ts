import type { ProductMutationInput, VariantMutationInput } from "@white-label/catalog";
import { moneyToCents } from "./format.ts";

export type ProductCreateDraft = {
  name: string;
  description: string;
  categoryIds: string[];
  price: string;
  discountEnabled: boolean;
  discountType: "percentage" | "fixed";
  discountValue: string;
  pixEnabled: boolean;
  pixDiscount: string;
  freeShipping: boolean;
  active: boolean;
  trackInventory: boolean;
  stock: string;
  sku: string;
};

export type VariantGroup = { name: string; values: string };
export type VariantDraft = { key: string; name: string; attributes: Record<string, string>; price: string; stock: string };

export const EMPTY_CREATE_DRAFT: ProductCreateDraft = {
  name: "", description: "", categoryIds: [], price: "", discountEnabled: false,
  discountType: "percentage", discountValue: "", pixEnabled: false, pixDiscount: "",
  freeShipping: false, active: true, trackInventory: true, stock: "0", sku: "",
};

export function slugifyProduct(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function stockNumber(value: string): number {
  const parsed = Number.parseInt(value || "0", 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function productCreateInput(draft: ProductCreateDraft, hasVariants: boolean): ProductMutationInput {
  return {
    name: draft.name.trim(), slug: slugifyProduct(draft.name), description: draft.description.trim() || null,
    sku: draft.sku.trim() || null, categoryId: draft.categoryIds[0] ?? null, categoryIds: draft.categoryIds,
    priceCents: moneyToCents(draft.price), compareAtPriceCents: null, costCents: null,
    discountType: draft.discountEnabled ? draft.discountType : null,
    discountValue: draft.discountEnabled ? (draft.discountType === "fixed" ? moneyToCents(draft.discountValue) : Math.round(Number(draft.discountValue) || 0)) : null,
    pixDiscountPercent: draft.pixEnabled ? Math.round(Number(draft.pixDiscount) || 0) : null,
    freeShipping: draft.freeShipping, active: draft.active,
    trackInventory: hasVariants ? false : draft.trackInventory,
    stockQuantity: hasVariants ? 0 : stockNumber(draft.stock), position: 0,
  };
}

export function variantInput(productId: string, variant: VariantDraft, index: number, basePrice: string): VariantMutationInput {
  return { productId, name: variant.name, sku: null, attributes: variant.attributes,
    priceCents: moneyToCents(variant.price || basePrice), compareAtPriceCents: null, costCents: null,
    active: true, stockQuantity: stockNumber(variant.stock), position: index };
}
