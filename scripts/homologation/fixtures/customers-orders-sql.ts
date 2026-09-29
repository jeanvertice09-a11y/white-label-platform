import { DEMO_STORES, DEMO_TENANTS } from "./data.ts";
import type { DemoProduct, DemoStore } from "../model.ts";
import { DEFAULT_ANCHOR_ISO, isoDaysFrom, quoteSql, stableUuid } from "../model.ts";

const FIRST_NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fabio", "Giovana", "Hugo", "Isabela", "Joao", "Larissa", "Marcos"] as const;
const LAST_NAMES = ["Alves", "Barbosa", "Campos", "Duarte", "Esteves", "Freitas", "Gomes", "Henrique", "Lima", "Moraes", "Nunes", "Oliveira"] as const;
const ORDER_STATUSES = ["completed", "completed", "completed", "completed", "completed", "completed", "completed", "completed", "confirmed", "confirmed", "preparing", "ready", "pending", "pending", "cancelled", "cancelled"] as const;
const ORIGINS = ["whatsapp", "online", "manual", "pdv"] as const;

function tenantId(store: DemoStore): string {
  const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
  if (!tenant) throw new Error(`tenant ausente: ${store.tenantKey}`);
  return tenant.id;
}

function customerId(store: DemoStore, index: number): string {
  return stableUuid(`${store.key}:customer:${index}`);
}

function customerRows(anchor: string): string {
  const rows: string[] = [];
  DEMO_STORES.forEach((store, storeIndex) => {
    for (let index = 0; index < 12; index += 1) {
      const name = `${FIRST_NAMES[index]} ${LAST_NAMES[(index + storeIndex * 2) % LAST_NAMES.length]}`;
      const phone = `55629${storeIndex + 1}${String(100000 + index).padStart(6, "0")}`;
      const created = isoDaysFrom(anchor, -78 + index * 3);
      rows.push(`(${quoteSql(customerId(store, index))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(name)},${quoteSql(phone)},${quoteSql(`${store.key}.${index + 1}@example.test`)},null,null,${quoteSql("Cliente fictício de homologação. Nenhum dado pertence a pessoa real.")},${quoteSql(created)}::timestamptz,${quoteSql(created)}::timestamptz)`);
    }
  });
  return rows.join(",\n");
}

function couponRows(anchor: string): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    const scope = `${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid`;
    rows.push(`(${quoteSql(stableUuid(`${store.key}:coupon:welcome`))}::uuid,${scope},'BEMVINDO10','Boas-vindas 10%',true,'percentage',10,5000,${quoteSql(isoDaysFrom(anchor, -80))}::timestamptz,${quoteSql(isoDaysFrom(anchor, 45))}::timestamptz,100,2,${quoteSql(isoDaysFrom(anchor, -80))}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
    rows.push(`(${quoteSql(stableUuid(`${store.key}:coupon:fixed`))}::uuid,${scope},'HML15','Desconto R$ 15',true,'fixed',1500,12000,${quoteSql(isoDaysFrom(anchor, -30))}::timestamptz,${quoteSql(isoDaysFrom(anchor, 30))}::timestamptz,50,0,${quoteSql(isoDaysFrom(anchor, -30))}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
    rows.push(`(${quoteSql(stableUuid(`${store.key}:coupon:expired`))}::uuid,${scope},'INVERNO20','Campanha encerrada 20%',false,'percentage',20,null,${quoteSql(isoDaysFrom(anchor, -75))}::timestamptz,${quoteSql(isoDaysFrom(anchor, -40))}::timestamptz,30,0,${quoteSql(isoDaysFrom(anchor, -75))}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
  }
  return rows.join(",\n");
}

function orderSelection(store: DemoStore, index: number): { product: DemoProduct; variantIndex: number | null; unitCents: number } {
  const product = store.products[index % store.products.length];
  if (!product) throw new Error(`produto ausente: ${store.key}/${index}`);
  if (product.variants.length === 0) return { product, variantIndex: null, unitCents: product.priceCents };
  const variantIndex = index % product.variants.length;
  return { product, variantIndex, unitCents: product.variants[variantIndex]?.priceCents ?? product.priceCents };
}

function orderMath(store: DemoStore, index: number): { subtotal: number; discount: number; shipping: number; total: number; qty: number } {
  const { unitCents } = orderSelection(store, index);
  const qty = 1 + (index % 2);
  const subtotal = unitCents * qty;
  const discount = index === 0 || index === 4 ? Math.floor(subtotal * 0.1) : 0;
  const shipping = index % 3 === 0 ? 1200 : 0;
  return { subtotal, discount, shipping, total: subtotal - discount + shipping, qty };
}

function orderRows(anchor: string): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    for (let index = 0; index < 16; index += 1) {
      const status = ORDER_STATUSES[index] ?? "pending";
      const created = isoDaysFrom(anchor, -75 + index * 4);
      const { subtotal, discount, shipping, total } = orderMath(store, index);
      const customerIndex = index % 12;
      const coupon = index === 0 || index === 4 ? stableUuid(`${store.key}:coupon:welcome`) : null;
      const payment = status === "completed" ? "paid" : status === "cancelled" ? "refunded" : "pending";
      const confirmedAt = status === "pending" ? "null" : `${quoteSql(isoDaysFrom(created, 1))}::timestamptz`;
      const completedAt = status === "completed" ? `${quoteSql(isoDaysFrom(created, 2))}::timestamptz` : "null";
      const cancelledAt = status === "cancelled" ? `${quoteSql(isoDaysFrom(created, 1))}::timestamptz` : "null";
      rows.push(`(${quoteSql(stableUuid(`${store.key}:order:${index}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(status)},${total},${quoteSql(created)}::timestamptz,${quoteSql(ORIGINS[index % ORIGINS.length] ?? "whatsapp")},${quoteSql(payment)},${quoteSql(`${FIRST_NAMES[customerIndex]} ${LAST_NAMES[customerIndex]}`)},${quoteSql(`55629${DEMO_STORES.indexOf(store) + 1}${String(100000 + customerIndex).padStart(6, "0")}`)},'Pedido fictício de homologação',${subtotal},${discount},${shipping},${quoteSql(anchor)}::timestamptz,${confirmedAt},${completedAt},${cancelledAt},${quoteSql(`hml-${store.key}-order-${index}`)},${quoteSql(customerId(store, customerIndex))}::uuid,${coupon === null ? "null" : `${quoteSql(coupon)}::uuid`},${coupon === null ? "null" : "'BEMVINDO10'"})`);
    }
  }
  return rows.join(",\n");
}

function itemRows(): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    for (let index = 0; index < 16; index += 1) {
      const selection = orderSelection(store, index);
      const math = orderMath(store, index);
      const variant = selection.variantIndex === null ? null : selection.product.variants[selection.variantIndex] ?? null;
      rows.push(`(${quoteSql(stableUuid(`${store.key}:order:${index}:item`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(stableUuid(`${store.key}:order:${index}`))}::uuid,${quoteSql(selection.product.id)}::uuid,${math.qty},${selection.unitCents},${variant ? `${quoteSql(variant.id)}::uuid` : "null"},${quoteSql(selection.product.name)},${variant ? quoteSql(variant.name) : "null"},${quoteSql(variant?.sku ?? selection.product.sku)},${selection.unitCents * math.qty})`);
    }
  }
  return rows.join(",\n");
}

function initialMovements(anchor: string): string[] {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    for (const product of store.products) {
      if (product.variants.length === 0) {
        rows.push(`(${quoteSql(stableUuid(`${store.key}:stock:initial:${product.id}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(product.id)}::uuid,${product.initialStock},'Saldo inicial da homologação',${quoteSql(isoDaysFrom(anchor, -82))}::timestamptz,null,'initial',null,null,null)`);
      } else {
        for (const variant of product.variants) rows.push(`(${quoteSql(stableUuid(`${store.key}:stock:initial:${variant.id}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(product.id)}::uuid,${variant.initialStock},'Saldo inicial da variante',${quoteSql(isoDaysFrom(anchor, -82))}::timestamptz,${quoteSql(variant.id)}::uuid,'initial',null,null,null)`);
      }
    }
  }
  return rows;
}

function orderMovements(anchor: string): string[] {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    for (let index = 0; index < 16; index += 1) {
      const status = ORDER_STATUSES[index] ?? "pending";
      if (status === "pending") continue;
      const selection = orderSelection(store, index);
      const math = orderMath(store, index);
      const variant = selection.variantIndex === null ? null : selection.product.variants[selection.variantIndex] ?? null;
      const orderId = stableUuid(`${store.key}:order:${index}`);
      const created = isoDaysFrom(anchor, -74 + index * 4);
      rows.push(`(${quoteSql(stableUuid(`${store.key}:stock:sale:${index}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(selection.product.id)}::uuid,${-math.qty},'Saída por pedido ${index + 1}',${quoteSql(created)}::timestamptz,${variant ? `${quoteSql(variant.id)}::uuid` : "null"},'sale','order',${quoteSql(orderId)}::uuid,null)`);
      if (status === "cancelled") rows.push(`(${quoteSql(stableUuid(`${store.key}:stock:cancel:${index}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(selection.product.id)}::uuid,${math.qty},'Restauração por cancelamento',${quoteSql(isoDaysFrom(created, 1))}::timestamptz,${variant ? `${quoteSql(variant.id)}::uuid` : "null"},'cancellation','order',${quoteSql(orderId)}::uuid,null)`);
    }
    const returned = orderSelection(store, 2);
    const returnedVariant = returned.variantIndex === null ? null : returned.product.variants[returned.variantIndex] ?? null;
    rows.push(`(${quoteSql(stableUuid(`${store.key}:stock:return`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(returned.product.id)}::uuid,1,'Retorno de cliente em homologação',${quoteSql(isoDaysFrom(anchor, -55))}::timestamptz,${returnedVariant ? `${quoteSql(returnedVariant.id)}::uuid` : "null"},'return','order',${quoteSql(stableUuid(`${store.key}:order:2`))}::uuid,null)`);
    const adjusted = store.products[15]; const manual = store.products[14];
    if (adjusted && manual) {
      rows.push(`(${quoteSql(stableUuid(`${store.key}:stock:adjustment`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(adjusted.id)}::uuid,3,'Ajuste de inventário contado',${quoteSql(isoDaysFrom(anchor, -18))}::timestamptz,null,'adjustment','inventory_count',${quoteSql(stableUuid(`${store.key}:inventory-count`))}::uuid,null)`);
      rows.push(`(${quoteSql(stableUuid(`${store.key}:stock:manual`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(manual.id)}::uuid,-1,'Baixa manual por avaria',${quoteSql(isoDaysFrom(anchor, -12))}::timestamptz,null,'manual','manual_adjustment',${quoteSql(stableUuid(`${store.key}:manual-adjustment`))}::uuid,null)`);
    }
  }
  return rows;
}

export function buildCustomersOrdersStockSql(configAnchor?: string): string {
  const anchor = configAnchor ?? DEFAULT_ANCHOR_ISO;
  const movements = [...initialMovements(anchor), ...orderMovements(anchor)].join(",\n");
  return `
insert into public.customers(id,tenant_id,store_id,name,phone,email,document,birth_date,notes,created_at,updated_at) values ${customerRows(anchor)};
insert into public.coupons(id,tenant_id,store_id,code,name,active,discount_type,discount_value,minimum_order_cents,starts_at,ends_at,usage_limit,usage_count,created_at,updated_at) values ${couponRows(anchor)};
insert into public.orders(id,tenant_id,store_id,status,total_cents,created_at,origin,payment_status,customer_name,customer_phone,notes,subtotal_cents,discount_cents,shipping_cents,updated_at,confirmed_at,completed_at,cancelled_at,idempotency_key,customer_id,coupon_id,coupon_code_snapshot) values ${orderRows(anchor)};
insert into public.order_items(id,tenant_id,store_id,order_id,product_id,qty,unit_cents,variant_id,product_name,variant_name,sku_snapshot,total_cents) values ${itemRows()};
insert into public.stock_movements(id,tenant_id,store_id,product_id,delta,reason,created_at,variant_id,movement_type,reference_type,reference_id,created_by) values ${movements};`;
}
