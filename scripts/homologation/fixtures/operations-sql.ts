import { DEMO_STORES, DEMO_TENANTS } from "./data.ts";
import type { DemoProduct, DemoStore, HomologationRuntimeConfig } from "../model.ts";
import { DEFAULT_ANCHOR_ISO, isoDate, isoDaysFrom, quoteSql, stableUuid } from "../model.ts";

const PURCHASE_STATUSES = ["received", "received", "draft", "cancelled"] as const;

function tenantId(store: DemoStore): string {
  const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
  if (!tenant) throw new Error(`tenant ausente: ${store.tenantKey}`);
  return tenant.id;
}

function supplierId(store: DemoStore, index: number): string {
  return stableUuid(`${store.key}:supplier:${index}`);
}

function supplierRows(anchor: string): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    const names = [`Distribuidora ${store.name.split(" ")[0]}`, `Atacado ${store.segment}`, `Parceiro Regional ${store.name.split(" ")[0]}`];
    names.forEach((name, index) => rows.push(`(${quoteSql(supplierId(store, index))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(name)},${quoteSql(`${name} HML`)},null,${quoteSql(`Contato ${index + 1}`)},${quoteSql(`556299800${DEMO_STORES.indexOf(store) + 1}${index + 1}`)},${quoteSql(`556299800${DEMO_STORES.indexOf(store) + 1}${index + 1}`)},${quoteSql(`fornecedor.${store.key}.${index + 1}@example.test`)},${quoteSql("Endereço fictício de homologação — Goiânia/GO")},${quoteSql("Fornecedor fictício; nenhum dado real." )},'active',${quoteSql(isoDaysFrom(anchor, -76 + index * 5))}::timestamptz,${quoteSql(anchor)}::timestamptz)`));
  }
  return rows.join(",\n");
}

function purchaseProduct(store: DemoStore, purchaseIndex: number, itemIndex: number): { product: DemoProduct; variant: DemoProduct["variants"][number] | null } {
  const product = store.products[purchaseIndex * 2 + itemIndex];
  if (!product) throw new Error(`produto de compra ausente: ${store.key}/${purchaseIndex}/${itemIndex}`);
  return { product, variant: product.variants[0] ?? null };
}

function purchaseItemData(store: DemoStore, purchaseIndex: number, itemIndex: number): { quantity: number; unitCost: number; subtotal: number } {
  const { product, variant } = purchaseProduct(store, purchaseIndex, itemIndex);
  const quantity = [10, 8, 5, 4][purchaseIndex] ?? 4;
  const unitCost = variant?.costCents ?? product.costCents;
  return { quantity, unitCost, subtotal: quantity * unitCost };
}

function purchaseTotal(store: DemoStore, purchaseIndex: number): number {
  return purchaseItemData(store, purchaseIndex, 0).subtotal + purchaseItemData(store, purchaseIndex, 1).subtotal;
}

function purchaseRows(config: HomologationRuntimeConfig, anchor: string): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    for (let index = 0; index < 4; index += 1) {
      const status = PURCHASE_STATUSES[index] ?? "draft";
      const purchased = isoDaysFrom(anchor, [-48, -24, -7, -35][index] ?? -7);
      const total = purchaseTotal(store, index);
      const receivedAt = status === "received" ? `${quoteSql(isoDaysFrom(purchased, 1))}::timestamptz` : "null";
      const cancelledAt = status === "cancelled" ? `${quoteSql(isoDaysFrom(purchased, 1))}::timestamptz` : "null";
      const owner = config.storeOwners[store.key];
      rows.push(`(${quoteSql(stableUuid(`${store.key}:purchase:${index}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(supplierId(store, index % 3))}::uuid,${quoteSql(isoDate(purchased))}::date,${quoteSql(status)},${total},0,0,${total},${quoteSql("Compra fictícia de homologação")},${quoteSql(owner)}::uuid,${status === "received" ? `${quoteSql(owner)}::uuid` : "null"},${receivedAt},${status === "cancelled" ? `${quoteSql(owner)}::uuid` : "null"},${cancelledAt},${quoteSql(purchased)}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
    }
  }
  return rows.join(",\n");
}

function purchaseItemRows(): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    for (let purchaseIndex = 0; purchaseIndex < 4; purchaseIndex += 1) {
      for (let itemIndex = 0; itemIndex < 2; itemIndex += 1) {
        const { product, variant } = purchaseProduct(store, purchaseIndex, itemIndex);
        const data = purchaseItemData(store, purchaseIndex, itemIndex);
        rows.push(`(${quoteSql(stableUuid(`${store.key}:purchase:${purchaseIndex}:item:${itemIndex}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(stableUuid(`${store.key}:purchase:${purchaseIndex}`))}::uuid,${quoteSql(product.id)}::uuid,${variant ? `${quoteSql(variant.id)}::uuid` : "null"},${quoteSql(product.name)},${variant ? quoteSql(variant.name) : "null"},${quoteSql(variant?.sku ?? product.sku)},${data.quantity},${data.unitCost},${data.subtotal},now())`);
      }
    }
  }
  return rows.join(",\n");
}

function purchaseMovements(anchor: string): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    for (let purchaseIndex = 0; purchaseIndex < 2; purchaseIndex += 1) {
      const purchaseId = stableUuid(`${store.key}:purchase:${purchaseIndex}`);
      for (let itemIndex = 0; itemIndex < 2; itemIndex += 1) {
        const { product, variant } = purchaseProduct(store, purchaseIndex, itemIndex);
        const data = purchaseItemData(store, purchaseIndex, itemIndex);
        rows.push(`(${quoteSql(stableUuid(`${store.key}:stock:purchase:${purchaseIndex}:${itemIndex}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(product.id)}::uuid,${data.quantity},'Entrada por compra recebida',${quoteSql(isoDaysFrom(anchor, purchaseIndex === 0 ? -47 : -23))}::timestamptz,${variant ? `${quoteSql(variant.id)}::uuid` : "null"},'purchase','merchant_purchase',${quoteSql(purchaseId)}::uuid,null)`);
      }
    }
  }
  return rows.join(",\n");
}

function financeCategoryRows(): string {
  const defs = [["Vendas", "income"], ["Compras", "expense"], ["Operacional", "expense"], ["Marketing", "both"]] as const;
  return DEMO_STORES.flatMap((store) => defs.map(([name, direction], index) => `(${quoteSql(stableUuid(`${store.key}:finance-category:${index}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(name)},${quoteSql(direction)},true,now(),now())`)).join(",\n");
}

function orderAmount(store: DemoStore, index: number): number {
  const product = store.products[index];
  if (!product) return 10000;
  const unit = product.variants[index % Math.max(product.variants.length, 1)]?.priceCents ?? product.priceCents;
  const qty = 1 + (index % 2);
  const subtotal = unit * qty;
  const discount = index === 0 || index === 4 ? Math.floor(subtotal * 0.1) : 0;
  const shipping = index % 3 === 0 ? 1200 : 0;
  return subtotal - discount + shipping;
}

function financeRows(config: HomologationRuntimeConfig, anchor: string): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    const owner = config.storeOwners[store.key];
    for (let index = 0; index < 4; index += 1) {
      const settled = index < 3;
      const due = isoDaysFrom(anchor, -58 + index * 12);
      rows.push(`(${quoteSql(stableUuid(`${store.key}:finance:receivable:${index}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,'receivable',${quoteSql(stableUuid(`${store.key}:finance-category:0`))}::uuid,${quoteSql(`Recebimento pedido HML ${index + 1}`)},${orderAmount(store, index)},${quoteSql(isoDate(due))}::date,${quoteSql(isoDate(due))}::date,${quoteSql(settled ? "settled" : "open")},${settled ? `${quoteSql(isoDaysFrom(due, 1))}::timestamptz` : "null"},null,${quoteSql(stableUuid(`${store.key}:customer:${index}`))}::uuid,${quoteSql(stableUuid(`${store.key}:order:${index}`))}::uuid,null,'Origem reconciliada com pedido',${quoteSql(owner)}::uuid,${quoteSql(due)}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
    }
    for (let index = 0; index < 4; index += 1) {
      const status = index === 0 ? "settled" : index === 3 ? "cancelled" : "open";
      const due = isoDaysFrom(anchor, -44 + index * 10);
      rows.push(`(${quoteSql(stableUuid(`${store.key}:finance:payable:${index}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,'payable',${quoteSql(stableUuid(`${store.key}:finance-category:1`))}::uuid,${quoteSql(`Pagamento compra HML ${index + 1}`)},${purchaseTotal(store, index)},${quoteSql(isoDate(due))}::date,${quoteSql(isoDate(due))}::date,${quoteSql(status)},${status === "settled" ? `${quoteSql(isoDaysFrom(due, 1))}::timestamptz` : "null"},${quoteSql(supplierId(store, index % 3))}::uuid,null,null,${quoteSql(stableUuid(`${store.key}:purchase:${index}`))}::uuid,'Origem reconciliada com compra',${quoteSql(owner)}::uuid,${quoteSql(due)}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
    }
    rows.push(`(${quoteSql(stableUuid(`${store.key}:finance:marketing`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,'payable',${quoteSql(stableUuid(`${store.key}:finance-category:3`))}::uuid,'Mídia de campanha de homologação',3900,${quoteSql(isoDate(isoDaysFrom(anchor, -9)))}::date,${quoteSql(isoDate(isoDaysFrom(anchor, -9)))}::date,'settled',${quoteSql(isoDaysFrom(anchor, -8))}::timestamptz,null,null,null,null,'Despesa demonstrativa',${quoteSql(owner)}::uuid,${quoteSql(isoDaysFrom(anchor, -10))}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
    rows.push(`(${quoteSql(stableUuid(`${store.key}:finance:other-income`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,'receivable',${quoteSql(stableUuid(`${store.key}:finance-category:3`))}::uuid,'Crédito comercial a receber',2500,${quoteSql(isoDate(isoDaysFrom(anchor, 5)))}::date,${quoteSql(isoDate(anchor))}::date,'open',null,null,null,null,null,'Recebível aberto para dashboard',${quoteSql(owner)}::uuid,${quoteSql(anchor)}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
  }
  return rows.join(",\n");
}

function taskRows(config: HomologationRuntimeConfig, anchor: string): string {
  const titles = ["Revisar estoque baixo", "Conferir compra recebida", "Atualizar vitrine", "Responder pedidos pendentes", "Revisar cupom ativo", "Organizar campanha CRM"];
  const priorities = ["high", "normal", "low", "high", "normal", "low"];
  return DEMO_STORES.flatMap((store) => titles.map((title, index) => {
    const done = index < 3; const due = isoDaysFrom(anchor, -6 + index * 3); const owner = config.storeOwners[store.key];
    return `(${quoteSql(stableUuid(`${store.key}:task:${index}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(title)},${quoteSql(`${title} — rotina fictícia de homologação`)},${quoteSql(priorities[index] ?? "normal")},${quoteSql(done ? "done" : "open")},${quoteSql(due)}::timestamptz,${quoteSql(owner)}::uuid,${quoteSql(owner)}::uuid,${done ? `${quoteSql(isoDaysFrom(due, -1))}::timestamptz` : "null"},${quoteSql(isoDaysFrom(anchor, -15 + index))}::timestamptz,${quoteSql(anchor)}::timestamptz)`;
  })).join(",\n");
}

export function buildOperationsSql(config: HomologationRuntimeConfig): string {
  const anchor = config.anchorIso ?? DEFAULT_ANCHOR_ISO;
  return `
insert into public.merchant_suppliers(id,tenant_id,store_id,name,trade_name,document,contact_name,phone,whatsapp,email,address,notes,status,created_at,updated_at) values ${supplierRows(anchor)};
insert into public.merchant_purchases(id,tenant_id,store_id,supplier_id,purchased_at,status,subtotal_cents,discount_cents,surcharge_cents,total_cents,notes,created_by,received_by,received_at,cancelled_by,cancelled_at,created_at,updated_at) values ${purchaseRows(config, anchor)};
insert into public.merchant_purchase_items(id,tenant_id,store_id,purchase_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_cost_cents,subtotal_cents,created_at) values ${purchaseItemRows()};
insert into public.stock_movements(id,tenant_id,store_id,product_id,delta,reason,created_at,variant_id,movement_type,reference_type,reference_id,created_by) values ${purchaseMovements(anchor)};
insert into public.merchant_financial_categories(id,tenant_id,store_id,name,direction,active,created_at,updated_at) values ${financeCategoryRows()};
insert into public.merchant_financial_entries(id,tenant_id,store_id,direction,category_id,description,amount_cents,due_at,competence_date,status,settled_at,supplier_id,customer_id,order_id,purchase_id,notes,created_by,created_at,updated_at) values ${financeRows(config, anchor)};
insert into public.merchant_tasks(id,tenant_id,store_id,title,description,priority,status,due_at,assignee_user_id,created_by,completed_at,created_at,updated_at) values ${taskRows(config, anchor)};
update public.product_variants v set stock_quantity=coalesce((select sum(sm.delta)::integer from public.stock_movements sm where sm.tenant_id=v.tenant_id and sm.store_id=v.store_id and sm.product_id=v.product_id and sm.variant_id=v.id),0),updated_at=${quoteSql(anchor)}::timestamptz where v.tenant_id in (${DEMO_TENANTS.map((tenant) => `${quoteSql(tenant.id)}::uuid`).join(",")});
update public.products p set stock_quantity=case when exists(select 1 from public.product_variants v where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id) then 0 else coalesce((select sum(sm.delta)::integer from public.stock_movements sm where sm.tenant_id=p.tenant_id and sm.store_id=p.store_id and sm.product_id=p.id and sm.variant_id is null),0) end,updated_at=${quoteSql(anchor)}::timestamptz where p.tenant_id in (${DEMO_TENANTS.map((tenant) => `${quoteSql(tenant.id)}::uuid`).join(",")});
do $$ begin if exists(select 1 from public.products where tenant_id in (${DEMO_TENANTS.map((tenant) => `${quoteSql(tenant.id)}::uuid`).join(",")}) and stock_quantity<0) or exists(select 1 from public.product_variants where tenant_id in (${DEMO_TENANTS.map((tenant) => `${quoteSql(tenant.id)}::uuid`).join(",")}) and stock_quantity<0) then raise exception 'homologation seed: estoque negativo'; end if; end $$;`;
}
