import { describe, expect, test } from "bun:test";
import {
  buildOrderWhatsappMessage,
  buildOrderWhatsappUrl,
} from "../../packages/orders/src/index.ts";
import type { Order } from "../../packages/orders/src/index.ts";

const order: Order = {
  tenantId: "tenant",
  storeId: "store",
  id: "order",
  orderNumber: 42,
  origin: "whatsapp",
  status: "pending",
  paymentStatus: "pending",
  customerId: null,
  customerName: null,
  customerPhone: null,
  couponId: null,
  couponCodeSnapshot: "PROMO10",
  notes: null,
  subtotalCents: 2598,
  discountCents: 260,
  shippingCents: 0,
  totalCents: 2338,
  createdAt: "2026-09-18T00:00:00Z",
  updatedAt: "2026-09-18T00:00:00Z",
  confirmedAt: null,
  completedAt: null,
  cancelledAt: null,
  items: [{
    tenantId: "tenant",
    storeId: "store",
    id: "item",
    orderId: "order",
    productId: "product",
    variantId: "variant",
    productName: "Camiseta",
    variantName: "P",
    skuSnapshot: "CAM-P",
    quantity: 2,
    unitCents: 1299,
    totalCents: 2598,
  }],
};

describe("order whatsapp", () => {
  test("mensagem usa snapshot e número amigável", () => {
    const message = buildOrderWhatsappMessage(order, "Olá");
    expect(message).toContain("Pedido #00000042");
    expect(message).toContain("2x Camiseta — P");
    expect(message).toContain("R$ 23,38");
  });

  test("url usa telefone normalizado", () => {
    expect(buildOrderWhatsappUrl("(62) 99999-0000", order, "Olá"))
      .toStartWith("https://wa.me/62999990000?text=");
  });
});
