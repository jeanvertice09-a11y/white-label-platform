import { assertSameCatalogScope } from "./scope.ts";
import type { Product, ProductVariant } from "./types.ts";

export class CatalogPricingError extends Error {
  constructor(readonly code: "PRODUCT_INACTIVE" | "VARIANT_REQUIRED" | "VARIANT_INVALID") {
    super(code);
  }
}

export interface PurchasableSelection {
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  unitPriceCents: number;
  compareAtPriceCents: number | null;
}

function selectVariant(product: Product, variantId: string): ProductVariant {
  const variant = product.variants.find((item) => item.id === variantId && item.active);
  if (!variant) throw new CatalogPricingError("VARIANT_INVALID");
  assertSameCatalogScope(product, variant);
  if (variant.productId !== product.id) throw new CatalogPricingError("VARIANT_INVALID");
  return variant;
}

export function resolvePurchasableSelection(
  product: Product,
  variantId?: string | null,
): PurchasableSelection {
  if (!product.active) throw new CatalogPricingError("PRODUCT_INACTIVE");
  const hasVariants = product.variants.length > 0;

  if (hasVariants) {
    if (!variantId) throw new CatalogPricingError("VARIANT_REQUIRED");
    const variant = selectVariant(product, variantId);
    return {
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantName: variant.name,
      unitPriceCents: variant.priceCents,
      compareAtPriceCents: variant.compareAtPriceCents,
    };
  }

  if (variantId) throw new CatalogPricingError("VARIANT_INVALID");
  return {
    productId: product.id,
    variantId: null,
    name: product.name,
    variantName: null,
    unitPriceCents: product.priceCents,
    compareAtPriceCents: product.compareAtPriceCents,
  };
}
