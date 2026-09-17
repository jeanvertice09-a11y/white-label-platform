import type { CatalogScope, Product } from "./types.ts";

export interface ProductVariant {
  id: string;
  tenantId: string;
  storeId: string;
  productId: string;
  name: string;
  sku: string | null;
  priceCents: number;
  active: boolean;
}

export class CatalogSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogSelectionError";
  }
}

function assertMoney(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CatalogSelectionError(`${label} inválido`);
  }
}

function assertSameScope(
  scope: CatalogScope,
  product: Product,
  variant?: ProductVariant,
): void {
  if (product.tenantId !== scope.tenantId || product.storeId !== scope.storeId) {
    throw new CatalogSelectionError("Produto fora do catálogo");
  }

  if (
    variant &&
    (variant.tenantId !== scope.tenantId ||
      variant.storeId !== scope.storeId ||
      variant.productId !== product.id)
  ) {
    throw new CatalogSelectionError("Variante fora do produto");
  }
}

/**
 * Resolve o preço unitário que vai para o carrinho.
 *
 * Regra crítica:
 * - produto sem variantes: usa product.priceCents;
 * - produto com variantes: exige variantId e usa EXATAMENTE variant.priceCents;
 * - nunca usa maior/menor preço como substituto para a variante selecionada.
 */
export function resolveCatalogUnitPrice(
  scope: CatalogScope,
  product: Product,
  variants: readonly ProductVariant[],
  selectedVariantId?: string | null,
): number {
  assertSameScope(scope, product);
  if (!product.active) throw new CatalogSelectionError("Produto indisponível");
  assertMoney(product.priceCents, "Preço do produto");

  const activeVariants = variants.filter((variant) => {
    assertSameScope(scope, product, variant);
    assertMoney(variant.priceCents, "Preço da variante");
    return variant.active;
  });

  if (activeVariants.length === 0) {
    if (selectedVariantId) {
      throw new CatalogSelectionError("Variante selecionada indisponível");
    }
    return product.priceCents;
  }

  if (!selectedVariantId) {
    throw new CatalogSelectionError("Selecione uma variante");
  }

  const selected = activeVariants.find((variant) => variant.id === selectedVariantId);
  if (!selected) {
    throw new CatalogSelectionError("Variante selecionada indisponível");
  }

  return selected.priceCents;
}

export function calculateCartLineTotal(unitPriceCents: number, quantity: number): number {
  assertMoney(unitPriceCents, "Preço unitário");
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
    throw new CatalogSelectionError("Quantidade inválida");
  }

  const total = unitPriceCents * quantity;
  assertMoney(total, "Total da linha");
  return total;
}
