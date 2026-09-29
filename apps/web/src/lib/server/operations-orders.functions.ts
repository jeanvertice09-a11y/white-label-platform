import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createOrderRepository } from "@white-label/orders";
import { normalizeCustomerPhone } from "@white-label/customers";
import { createMerchantOperationsContext } from "./operations-context.server.ts";
import { assertOrdersEntitlement } from "./orders-entitlements.server.ts";
import { getStoreOrderPayment, refundStoreOrderPayment } from "./mercadopago-store-payment.server.ts";

const uuid = z.string().uuid();
const idSchema = z.object({ id: z.string().uuid() });
const advanceSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["preparing", "ready", "completed"]),
});
const listSchema = z.object({
  page: z.number().int().min(1).max(10_000),
  pageSize: z.number().int().min(1).max(100),
  search: z.string().trim().max(160).optional(),
  status: z.enum([
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
    "cancelled",
  ]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const manualOrderSchema = z.object({
  idempotencyKey: uuid,
  customerName: z.string().trim().max(160).nullable(),
  customerPhone: z.string().trim().max(30).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  items: z.array(z.object({
    productId: uuid,
    variantId: uuid.nullable(),
    quantity: z.number().int().min(1).max(999),
  })).min(1).max(100),
});

async function context() {
  const current = await createMerchantOperationsContext(getRequestHost());
  await assertOrdersEntitlement(current.sql, current.scope);
  return {
    scope: current.scope,
    userId: current.userId,
    sql: current.sql,
    repository: createOrderRepository(current.sql),
  };
}

export const createMerchantManualOrder = createServerFn({ method: "POST" })
  .validator(manualOrderSchema)
  .handler(async ({ data }) => {
    const current = await context();
    const order = await current.repository.createFromCart(current.scope, {
      idempotencyKey: data.idempotencyKey,
      origin: "manual",
      customerName: data.customerName,
      customerPhone: data.customerPhone ? normalizeCustomerPhone(data.customerPhone) : null,
      notes: data.notes,
      shippingCents: 0,
      items: data.items,
    });
    await current.sql.query(
      `insert into public.audit_logs
        (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $1::uuid,$2::uuid,$3::uuid,'order.manual_created','order',$4,
         jsonb_build_object('order_number',$5::integer,'item_count',$6::integer)
       where not exists (
         select 1 from public.audit_logs
         where tenant_id=$2::uuid and store_id=$3::uuid
           and action='order.manual_created' and resource_type='order' and resource_id=$4
       ) returning id`,
      [current.userId, current.scope.tenantId, current.scope.storeId, order.id, order.orderNumber, order.items.length],
    );
    return order;
  });

export const listMerchantOrders = createServerFn({ method: "GET" })
  .validator(listSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.listPage(current.scope, data);
  });

export const getMerchantOrder = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.getById(current.scope, data.id);
  });

export const getMerchantOrderDetail = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    const order = await current.repository.getById(current.scope, data.id);
    if (!order) return null;
    const [timeline, payment] = await Promise.all([
      current.repository.getTimeline(current.scope, data.id),
      getStoreOrderPayment(current.scope, data.id),
    ]);
    return { order, timeline, payment };
  });

export const confirmMerchantOrder = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.confirm(current.scope, data.id, current.userId);
  });

export const cancelMerchantOrder = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.cancel(current.scope, data.id, current.userId);
  });

export const advanceMerchantOrder = createServerFn({ method: "POST" })
  .validator(advanceSchema)
  .handler(async ({ data }) => {
    const current = await context();
    return current.repository.advance(
      current.scope,
      data.id,
      data.status,
      current.userId,
    );
  });

export const refundMerchantOrderPayment = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const current = await context();
    const order = await current.repository.getById(current.scope, data.id);
    if (!order) throw new Error("Pedido não encontrado.");
    const result = await refundStoreOrderPayment(current.scope, data.id);
    await current.sql.query(
      `insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       values($1::uuid,$2::uuid,$3::uuid,'payment.refund_requested','order',$4,jsonb_build_object('payment_id',$5))`,
      [current.userId,current.scope.tenantId,current.scope.storeId,data.id,result.paymentId],
    );
    return result;
  });
