import { describe, expect, test } from "bun:test";
import { verifyShippingSelection } from "../../apps/web/src/lib/server/shipping-selection.ts";
import { resolveCheckoutShipping } from "../../apps/web/src/lib/server/storefront-shipping.server.ts";

const providerQuote = {
  serviceId: 14,
  serviceName: "Entrega",
  companyName: "Transportadora",
  priceCents: 1590,
  deliveryDays: 3,
  snapshot: '{"id":14,"price":"15.90"}',
};

describe("checkout shipping selection", () => {
  test("uses the provider quote when the displayed amount still matches", () => {
    expect(verifyShippingSelection([providerQuote], 14, 1590)).toBe(providerQuote);
  });

  test("rejects a forged or stale amount before charging the order", () => {
    expect(() => verifyShippingSelection([providerQuote], 14, 0)).toThrow("valor do frete mudou");
    expect(() => verifyShippingSelection([providerQuote], 14, 1490)).toThrow("valor do frete mudou");
  });

  test("rejects services not returned by the provider for this cart and postal code", () => {
    expect(() => verifyShippingSelection([providerQuote], 99, 1590)).toThrow("Frete indisponível");
  });

  test("cannot skip shipping when the store requires it", async () => {
    const scope = { tenantId: "tenant-a", storeId: "store-a" };
    const items = [{ productId: "product-a", variantId: null, quantity: 1 }];
    const deps = {
      isEnabled: () => Promise.resolve(true),
      quote: () => Promise.resolve([providerQuote]),
    };
    expect(resolveCheckoutShipping(scope, items, null, deps)).rejects.toThrow("selecione uma entrega");
    expect(resolveCheckoutShipping(scope, items, {
      serviceId: 14, priceCents: 0, recipient: { postalCode: "01001000" },
    }, deps)).rejects.toThrow("valor do frete mudou");
    expect(await resolveCheckoutShipping(scope, items, {
      serviceId: 14, priceCents: 1590, recipient: { postalCode: "01001000" },
    }, deps)).toEqual(providerQuote);
  });
});
