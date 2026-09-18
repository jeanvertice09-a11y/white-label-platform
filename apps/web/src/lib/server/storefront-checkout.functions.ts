import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { normalizeCustomerPhone } from "@white-label/customers";
import {
  buildOrderWhatsappUrl,
  createOrderRepository,
  formatOrderNumber,
} from "@white-label/orders";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createPublicCatalogContext } from "./catalog-context.server.ts";
import { assertOrdersEntitlement } from "./orders-entitlements.server.ts";

const checkoutSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  customerName: z.string().trim().max(160).nullable(),
  customerPhone: z.string().trim().max(30).nullable(),
  couponCode: z.string().trim().max(40).nullable(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable(),
    quantity: z.number().int().min(1).max(999),
  })).min(1).max(100),
});

export const createWhatsappOrder = createServerFn({ method: "POST" })
  .validator(checkoutSchema)
  .handler(async ({ data }) => {
    const catalog = await createPublicCatalogContext(getRequestHost());
    const settings = await catalog.repository.getSettings(catalog.scope);
    if (settings.checkoutMode === "online") {
      throw new Error("Checkout por WhatsApp indisponível");
    }
    if (!settings.whatsappPhone) {
      throw new Error("WhatsApp não configurado");
    }
    const customerPhone = data.customerPhone
      ? normalizeCustomerPhone(data.customerPhone)
      : null;
    const sql = createAdminSqlExecutor();
    await assertOrdersEntitlement(sql, catalog.scope);
    const orders = createOrderRepository(sql);
    const order = await orders.createFromCart(catalog.scope, {
      idempotencyKey: data.idempotencyKey,
      origin: "whatsapp",
      customerName: data.customerName,
      customerPhone,
      couponCode: data.couponCode,
      notes: null,
      shippingCents: 0,
      items: data.items,
    });
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      displayNumber: formatOrderNumber(order.orderNumber),
      totalCents: order.totalCents,
      discountCents: order.discountCents,
      whatsappUrl: buildOrderWhatsappUrl(
        settings.whatsappPhone,
        order,
        settings.whatsappMessage,
      ),
    };
  });
