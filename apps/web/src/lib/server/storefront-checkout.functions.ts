import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { getCatalogAdvancedSettings, getCatalogBehavior, resolvePurchasableSelection } from "@white-label/catalog";
import { normalizeCustomerPhone } from "@white-label/customers";
import { buildOrderWhatsappUrl, createOrderRepository, formatOrderNumber } from "@white-label/orders";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createPublicCatalogContext } from "./catalog-context.server.ts";
import { assertCouponsEntitlement } from "./marketing-entitlements.server.ts";
import { assertOrdersEntitlement } from "./orders-entitlements.server.ts";
import { enforceRateLimit } from "./rate-limit.server.ts";
import { createStorePixPayment } from "./mercadopago-store-payment.server.ts";
import { shippingAddressSchema } from "./storefront-shipping.functions.ts";
import { saveOrderShipping } from "./order-shipping.server.ts";

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1).max(999),
});
const refreshCartSchema = z.object({ items: z.array(cartItemSchema).max(100) });
const checkoutSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  customerName: z.string().trim().max(160).nullable(),
  customerPhone: z.string().trim().max(30).nullable(),
  couponCode: z.string().trim().max(40).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  items: z.array(cartItemSchema).min(1).max(100),
});

const shippingSelection=z.object({serviceId:z.number().int().positive(),serviceName:z.string().min(1).max(120),companyName:z.string().max(120),priceCents:z.number().int().min(0),deliveryDays:z.number().int().min(0),snapshot:z.string().max(50000),recipient:shippingAddressSchema});
const onlineCheckoutSchema = checkoutSchema.extend({ payerEmail: z.string().trim().email().max(254), shipping: shippingSelection.nullable() });
type CartRequestItem = z.infer<typeof cartItemSchema>;

function itemKey(item: Pick<CartRequestItem, "productId" | "variantId">): string {
  return `${item.productId}:${item.variantId ?? "base"}`;
}

function hasDuplicateSelection(items: CartRequestItem[]): boolean {
  const keys = new Set<string>();
  for (const item of items) {
    const key = itemKey(item);
    if (keys.has(key)) return true;
    keys.add(key);
  }
  return false;
}

function normalizeRefreshItems(items: CartRequestItem[], quantityEnabled: boolean): CartRequestItem[] {
  const grouped = new Map<string, CartRequestItem>();
  for (const item of items) {
    const key = itemKey(item);
    const previous = grouped.get(key);
    const quantity = quantityEnabled ? Math.min(999, (previous?.quantity ?? 0) + item.quantity) : 1;
    grouped.set(key, { productId: item.productId, variantId: item.variantId, quantity });
  }
  return [...grouped.values()];
}

export const createWhatsappOrder = createServerFn({ method: "POST" }).validator(checkoutSchema).handler(async ({ data }) => {
  const catalog = await createPublicCatalogContext(getRequestHost());
  const settings = await catalog.repository.getSettings(catalog.scope);
  const behavior = getCatalogBehavior(settings);
  const advanced = getCatalogAdvancedSettings(settings);
  if (behavior.catalogOnly || !behavior.cartEnabled || !behavior.showBuyButton) throw new Error("Pedidos desativados neste catálogo");
  if (!behavior.quantityEnabled && (data.items.some((item) => item.quantity !== 1) || hasDuplicateSelection(data.items))) throw new Error("Quantidade personalizada desativada neste catálogo");
  if (!behavior.showWhatsapp || settings.checkoutMode === "online") throw new Error("Checkout por WhatsApp indisponível");
  if (!settings.whatsappPhone) throw new Error("WhatsApp não configurado");
  const customerName = advanced.checkoutAskName ? data.customerName : null;
  const customerPhone = advanced.checkoutAskPhone && data.customerPhone ? normalizeCustomerPhone(data.customerPhone) : null;
  const notes = advanced.checkoutAskNotes ? data.notes : null;
  const sql = createAdminSqlExecutor();
  await enforceRateLimit(sql, `checkout:${catalog.scope.tenantId}:${catalog.scope.storeId}`, 30, 60);
  await assertOrdersEntitlement(sql, catalog.scope);
  if (data.couponCode?.trim()) await assertCouponsEntitlement(sql, catalog.scope);
  const orders = createOrderRepository(sql);
  const order = await orders.createFromCart(catalog.scope, {
    idempotencyKey: data.idempotencyKey, origin: "whatsapp", customerName, customerPhone,
    couponCode: data.couponCode, notes, shippingCents: 0, minimumOrderCents: advanced.minimumOrderCents, items: data.items,
  });
  return {
    orderId: order.id, orderNumber: order.orderNumber, displayNumber: formatOrderNumber(order.orderNumber), status: order.status,
    subtotalCents: order.subtotalCents, discountCents: order.discountCents, totalCents: order.totalCents,
    items: order.items.map((item) => ({ productId: item.productId, variantId: item.variantId, productName: item.productName, variantName: item.variantName, quantity: item.quantity, unitCents: item.unitCents, totalCents: item.totalCents })),
    whatsappUrl: buildOrderWhatsappUrl(settings.whatsappPhone, order, settings.whatsappMessage),
  };
});


export const createOnlinePixOrder = createServerFn({ method: "POST" }).validator(onlineCheckoutSchema).handler(async ({ data }) => {
  const catalog = await createPublicCatalogContext(getRequestHost());
  const settings = await catalog.repository.getSettings(catalog.scope);
  const behavior = getCatalogBehavior(settings);
  const advanced = getCatalogAdvancedSettings(settings);
  if (behavior.catalogOnly || !behavior.cartEnabled || !behavior.showBuyButton) throw new Error("Pedidos desativados neste catálogo");
  if (settings.checkoutMode === "whatsapp") throw new Error("Checkout online indisponível");
  if (!behavior.quantityEnabled && (data.items.some((item) => item.quantity !== 1) || hasDuplicateSelection(data.items))) throw new Error("Quantidade personalizada desativada neste catálogo");
  const customerName = advanced.checkoutAskName ? data.customerName : null;
  const customerPhone = advanced.checkoutAskPhone && data.customerPhone ? normalizeCustomerPhone(data.customerPhone) : null;
  const notes = advanced.checkoutAskNotes ? data.notes : null;
  const sql = createAdminSqlExecutor();
  await enforceRateLimit(sql, `checkout:online:${catalog.scope.tenantId}:${catalog.scope.storeId}`, 20, 60);
  await assertOrdersEntitlement(sql, catalog.scope);
  if (data.couponCode?.trim()) await assertCouponsEntitlement(sql, catalog.scope);
  const order = await createOrderRepository(sql).createFromCart(catalog.scope, {
    idempotencyKey: data.idempotencyKey, origin: "online", customerName, customerPhone,
    couponCode: data.couponCode, notes, shippingCents: data.shipping?.priceCents ?? 0, minimumOrderCents: advanced.minimumOrderCents, items: data.items,
  });
  if(data.shipping) await saveOrderShipping(catalog.scope,order.id,data.shipping);
  const payment = await createStorePixPayment(catalog.scope, {
    orderId: order.id, orderNumber: order.orderNumber, amountCents: order.totalCents, payerEmail: data.payerEmail,
  });
  if (!payment.checkout.qrCode && !payment.checkout.ticketUrl) throw new Error("Mercado Pago não retornou os dados do Pix.");
  return {
    orderId: order.id, orderNumber: order.orderNumber, displayNumber: formatOrderNumber(order.orderNumber),
    paymentId: payment.paymentId, status: order.status, paymentStatus: order.paymentStatus,
    subtotalCents: order.subtotalCents, discountCents: order.discountCents, totalCents: order.totalCents,
    items: order.items.map((item) => ({ productId: item.productId, variantId: item.variantId, productName: item.productName,
      variantName: item.variantName, quantity: item.quantity, unitCents: item.unitCents, totalCents: item.totalCents })),
    pix: payment.checkout,
  };
});

export const refreshPublicCart = createServerFn({ method: "POST" }).validator(refreshCartSchema).handler(async ({ data }) => {
  const catalog = await createPublicCatalogContext(getRequestHost());
  const settings = await catalog.repository.getSettings(catalog.scope);
  const behavior = getCatalogBehavior(settings);
  const advanced = getCatalogAdvancedSettings(settings);
  if (behavior.catalogOnly || !behavior.cartEnabled || !behavior.showBuyButton) throw new Error("Carrinho desativado neste catálogo");
  const sql = createAdminSqlExecutor();
  await assertOrdersEntitlement(sql, catalog.scope);
  const requested = normalizeRefreshItems(data.items, behavior.quantityEnabled);
  const items: Array<{ productId: string; variantId: string | null; name: string; variantName: string | null; quantity: number; unitPriceCents: number }> = [];
  for (const item of requested) {
    const product = await catalog.repository.getProductById(catalog.scope, item.productId, true);
    if (!product) continue;
    try {
      const selection = resolvePurchasableSelection(product, item.variantId);
      const variant = selection.variantId ? product.variants.find((candidate) => candidate.id === selection.variantId) : undefined;
      const stockLimit = product.trackInventory ? (variant?.stockQuantity ?? product.stockQuantity) : 999;
      if (stockLimit <= 0) continue;
      const quantity = behavior.quantityEnabled ? Math.min(item.quantity, stockLimit, 999) : 1;
      items.push({
        productId: selection.productId,
        variantId: selection.variantId,
        name: selection.name,
        variantName: selection.variantName,
        quantity,
        unitPriceCents: selection.unitPriceCents,
      });
    } catch {
      // Produto/variante deixou de ser uma seleção pública comprável.
    }
  }
  return {
    items,
    subtotalCents: items.reduce((total, item) => total + item.unitPriceCents * item.quantity, 0),
    minimumOrderCents: advanced.minimumOrderCents,
  };
});
