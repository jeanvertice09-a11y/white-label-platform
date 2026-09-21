import { describe, expect, test } from "bun:test";
import {
  cartStorageKey,
  restoreCart,
  serializeCart,
} from "../../packages/catalog/src/index.ts";
import type { CartState } from "../../packages/catalog/src/index.ts";

const scopeA = { tenantId: "tenant-a", storeId: "store-a" };
const scopeB = { tenantId: "tenant-a", storeId: "store-b" };

function cart(): CartState {
  return {
    ...scopeA,
    items: [{
      productId: "product-a",
      variantId: "variant-a",
      name: "Produto",
      variantName: "Azul",
      quantity: 2,
      unitPriceCents: 1299,
    }],
  };
}

describe("catalog cart storage", () => {
  test("usa chave isolada por tenant e store", () => {
    expect(cartStorageKey(scopeA)).not.toBe(cartStorageKey(scopeB));
  });

  test("restaura somente carrinho do mesmo escopo", () => {
    const raw = serializeCart(cart());
    expect(restoreCart(scopeA, raw).items).toHaveLength(1);
    expect(restoreCart(scopeB, raw).items).toHaveLength(0);
  });

  test("descarta conteúdo inválido do navegador", () => {
    const raw = JSON.stringify({
      version: 1,
      ...scopeA,
      items: [
        { productId: "p", variantId: null, name: "Ok", variantName: null, quantity: 1, unitPriceCents: 100 },
        { productId: "x", variantId: null, name: "Inválido", variantName: null, quantity: -2, unitPriceCents: -10 },
      ],
    });
    const restored = restoreCart(scopeA, raw);
    expect(restored.items).toHaveLength(1);
    expect(restored.items[0]?.name).toBe("Ok");
    expect(restoreCart(scopeA, "{inválido").items).toHaveLength(0);
  });
});
