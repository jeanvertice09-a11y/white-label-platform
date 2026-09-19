import { PLATFORM_GATEWAY_ID } from "../cleanup.ts";
import { DEMO_STORES, DEMO_TENANTS } from "./data.ts";
import type { DemoStore, HomologationRuntimeConfig, StoreKey, TenantKey } from "../model.ts";
import { DEFAULT_ANCHOR_ISO, isoDaysFrom, quoteSql, stableUuid, tenantPlanIdFor } from "../model.ts";
import type { PreflightResult } from "../preflight.ts";

function tenantId(store: DemoStore): string {
  const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
  if (!tenant) throw new Error(`tenant ausente: ${store.tenantKey}`);
  return tenant.id;
}

function storeSubscriptionId(storeKey: StoreKey): string { return stableUuid(`store-subscription:${storeKey}`); }
function platformSubscriptionId(tenantKey: TenantKey): string { return stableUuid(`platform-subscription:${tenantKey}`); }
function tenantGatewayId(tenantKey: TenantKey): string { return stableUuid(`gateway:tenant:${tenantKey}`); }
function storeGatewayId(storeKey: StoreKey): string { return stableUuid(`gateway:store:${storeKey}`); }

function money(value: number | null, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`${label} inválido`);
  return Number(value);
}

function tenantPlanRows(preflight: PreflightResult, config: HomologationRuntimeConfig, anchor: string): string {
  return DEMO_STORES.map((store, index) => {
    const plan = config.storePlans[store.key];
    const templateId = preflight.templateIds[store.key];
    const id = tenantPlanIdFor(store.tenantKey, plan.templateCode);
    const price = money(plan.priceCents, `price ${store.key}`);
    const interval = plan.billingInterval;
    const trialEnabled = plan.trialEnabled;
    const trialDays = plan.trialDays;
    if (!interval || typeof trialEnabled !== "boolean" || !Number.isSafeInteger(trialDays)) throw new Error(`plano incompleto: ${store.key}`);
    return `(${quoteSql(id)}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(templateId)}::uuid,${quoteSql(plan.slug)},${quoteSql(plan.name)},${quoteSql(`Plano HML da ${store.name}; valores fornecidos explicitamente pelo config operacional.`)},${price},${quoteSql(interval)},true,${trialEnabled ? "true" : "false"},${String(trialDays)},${String((index + 1) * 10)},false,${quoteSql(isoDaysFrom(anchor, -82))}::timestamptz,${quoteSql(anchor)}::timestamptz)`;
  }).join(",\n");
}

function platformSubscriptionRows(platformPlanId: string, anchor: string): string {
  return DEMO_TENANTS.map((tenant, index) => {
    const status = index === 0 ? "active" : "past_due";
    const started = isoDaysFrom(anchor, -84 + index * 3);
    const periodStart = index === 0 ? isoDaysFrom(anchor, -10) : isoDaysFrom(anchor, -40);
    const periodEnd = index === 0 ? isoDaysFrom(anchor, 20) : isoDaysFrom(anchor, -10);
    return `(${quoteSql(platformSubscriptionId(tenant.key))}::uuid,'platform_billing',${quoteSql(tenant.id)}::uuid,${quoteSql(platformPlanId)}::uuid,${quoteSql(status)},${quoteSql(started)}::timestamptz,${quoteSql(started)}::timestamptz,null,null,${quoteSql(periodStart)}::timestamptz,${quoteSql(periodEnd)}::timestamptz,null,${quoteSql(anchor)}::timestamptz)`;
  }).join(",\n");
}

function storeSubscriptionRows(config: HomologationRuntimeConfig, anchor: string): string {
  const statuses = ["active", "trialing", "active", "past_due"] as const;
  return DEMO_STORES.map((store, index) => {
    const status = statuses[index] ?? "active";
    const plan = config.storePlans[store.key];
    const planId = tenantPlanIdFor(store.tenantKey, plan.templateCode);
    const started = isoDaysFrom(anchor, -70 + index * 5);
    const periodStart = status === "trialing" ? "null" : `${quoteSql(index === 3 ? isoDaysFrom(anchor, -38) : isoDaysFrom(anchor, -8))}::timestamptz`;
    const periodEnd = status === "trialing" ? "null" : `${quoteSql(index === 3 ? isoDaysFrom(anchor, -8) : isoDaysFrom(anchor, 22))}::timestamptz`;
    return `(${quoteSql(storeSubscriptionId(store.key))}::uuid,'tenant_billing',${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(planId)}::uuid,${quoteSql(status)},${quoteSql(started)}::timestamptz,null,null,${periodStart},${periodEnd},null,${quoteSql(started)}::timestamptz,${quoteSql(anchor)}::timestamptz)`;
  }).join(",\n");
}

function gatewayRows(anchor: string): string {
  const rows = [`(${quoteSql(PLATFORM_GATEWAY_ID)}::uuid,'platform_billing',null,null,'mercadopago','HML Kataluu — sem chamadas externas','hml-internal-only','disabled',${quoteSql(anchor)}::timestamptz,${quoteSql(anchor)}::timestamptz)`];
  for (const tenant of DEMO_TENANTS) rows.push(`(${quoteSql(tenantGatewayId(tenant.key))}::uuid,'tenant_billing',${quoteSql(tenant.id)}::uuid,null,'mercadopago',${quoteSql(`HML ${tenant.name} — sem chamadas externas`)},'hml-internal-only','disabled',${quoteSql(anchor)}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
  for (const store of DEMO_STORES) rows.push(`(${quoteSql(storeGatewayId(store.key))}::uuid,'store_checkout',${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,'mercadopago',${quoteSql(`HML ${store.name} — sem chamadas externas`)},'hml-internal-only','disabled',${quoteSql(anchor)}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
  return rows.join(",\n");
}

interface InvoiceSpec {
  id: string;
  level: "platform_billing" | "tenant_billing";
  tenantId: string;
  storeId: string | null;
  periodStart: string;
  periodEnd: string;
  total: number;
  status: "open" | "paid" | "void";
  dueAt: string;
  paidAt: string | null;
}

function platformInvoices(config: HomologationRuntimeConfig, anchor: string): InvoiceSpec[] {
  const specs: InvoiceSpec[] = [];
  for (const [tenantIndex, tenant] of DEMO_TENANTS.entries()) {
    const amount = money(config.platformBillingAmountCents[tenant.key], `platform billing ${tenant.key}`);
    for (let period = 0; period < 3; period += 1) {
      const start = isoDaysFrom(anchor, -90 + period * 30);
      const end = isoDaysFrom(anchor, -60 + period * 30);
      const current = period === 2;
      const overdue = tenantIndex === 1 && current;
      const status = current ? "open" : "paid";
      specs.push({
        id: stableUuid(`invoice:platform:${tenant.key}:${period}`), level: "platform_billing", tenantId: tenant.id, storeId: null,
        periodStart: start, periodEnd: end, total: amount, status,
        dueAt: overdue ? isoDaysFrom(anchor, -5) : current ? isoDaysFrom(anchor, 5) : isoDaysFrom(end, 7),
        paidAt: status === "paid" ? isoDaysFrom(end, 5) : null,
      });
    }
  }
  return specs;
}

function tenantInvoices(config: HomologationRuntimeConfig, anchor: string): InvoiceSpec[] {
  const specs: InvoiceSpec[] = [];
  for (const store of DEMO_STORES) {
    const amount = money(config.storePlans[store.key].priceCents, `tenant billing ${store.key}`);
    for (let period = 0; period < 2; period += 1) {
      const start = isoDaysFrom(anchor, -60 + period * 30);
      const end = isoDaysFrom(anchor, -30 + period * 30);
      const current = period === 1;
      const trial = store.key === "botanica";
      const overdue = store.key === "casa" && current;
      const status: InvoiceSpec["status"] = trial ? "void" : overdue ? "open" : "paid";
      specs.push({
        id: stableUuid(`invoice:tenant:${store.key}:${period}`), level: "tenant_billing", tenantId: tenantId(store), storeId: store.id,
        periodStart: start, periodEnd: end, total: amount, status,
        dueAt: overdue ? isoDaysFrom(anchor, -4) : isoDaysFrom(end, 5), paidAt: status === "paid" ? isoDaysFrom(end, 3) : null,
      });
    }
  }
  return specs;
}

function invoiceRows(specs: InvoiceSpec[], anchor: string): string {
  return specs.map((invoice) => `(${quoteSql(invoice.id)}::uuid,${quoteSql(invoice.level)},${quoteSql(invoice.tenantId)}::uuid,${invoice.storeId ? `${quoteSql(invoice.storeId)}::uuid` : "null"},${quoteSql(invoice.periodStart)}::timestamptz,${quoteSql(invoice.periodEnd)}::timestamptz,${invoice.total},${invoice.total},'BRL',${quoteSql(invoice.status)},null,${quoteSql(invoice.dueAt)}::timestamptz,${invoice.paidAt ? `${quoteSql(invoice.paidAt)}::timestamptz` : "null"},${quoteSql(invoice.periodEnd)}::timestamptz,${quoteSql(anchor)}::timestamptz)`).join(",\n");
}

function billingEventRows(specs: InvoiceSpec[]): string {
  return specs.map((invoice) => `(${quoteSql(stableUuid(`billing-event:${invoice.id}`))}::uuid,${quoteSql(invoice.level)},${quoteSql(invoice.tenantId)}::uuid,${invoice.storeId ? `${quoteSql(invoice.storeId)}::uuid` : "null"},${quoteSql(invoice.id)}::uuid,'homologation_subscription_period',1,${invoice.total},${invoice.total},'BRL',${quoteSql(invoice.periodStart)}::timestamptz,${quoteSql(invoice.periodEnd)}::timestamptz,${quoteSql(invoice.status === "void" ? "void" : "invoiced")},${quoteSql(`hml:${invoice.id}`)},'{}'::jsonb,${quoteSql(invoice.periodEnd)}::timestamptz)`).join(",\n");
}

function platformPaymentRows(config: HomologationRuntimeConfig, anchor: string): string[] {
  const rows: string[] = [];
  for (const [tenantIndex, tenant] of DEMO_TENANTS.entries()) {
    const amount = money(config.platformBillingAmountCents[tenant.key], `platform payment ${tenant.key}`);
    const statuses = tenantIndex === 0 ? ["captured", "captured", "pending"] : ["captured", "captured", "failed"];
    statuses.forEach((status, index) => {
      const created = isoDaysFrom(anchor, -55 + index * 25);
      rows.push(`(${quoteSql(stableUuid(`payment:platform:${tenant.key}:${index}`))}::uuid,'platform_billing',${quoteSql(tenant.id)}::uuid,null,${quoteSql(PLATFORM_GATEWAY_ID)}::uuid,${quoteSql(`hml-internal-platform-${tenant.key}-${index}`)},${amount},'BRL',${quoteSql(status ?? "pending")},${quoteSql(created)}::timestamptz,${quoteSql(platformSubscriptionId(tenant.key))}::uuid,${quoteSql(`hml-platform-${tenant.key}-${index}`)},null,${status === "captured" || status === "failed" ? quoteSql(status) : "null"},${quoteSql(created)}::timestamptz,null,null,null,null)`);
    });
  }
  return rows;
}

function tenantPaymentRows(config: HomologationRuntimeConfig, anchor: string): string[] {
  const rows: string[] = [];
  for (const store of DEMO_STORES.filter((item) => item.key !== "botanica")) {
    const statuses = store.key === "casa" ? ["captured", "captured", "failed"] : ["captured", "captured"];
    const amount = money(config.storePlans[store.key].priceCents, `tenant payment ${store.key}`);
    statuses.forEach((status, index) => {
      const created = isoDaysFrom(anchor, -58 + index * 24);
      rows.push(`(${quoteSql(stableUuid(`payment:tenant:${store.key}:${index}`))}::uuid,'tenant_billing',${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(tenantGatewayId(store.tenantKey))}::uuid,${quoteSql(`hml-internal-tenant-${store.key}-${index}`)},${amount},'BRL',${quoteSql(status ?? "captured")},${quoteSql(created)}::timestamptz,null,${quoteSql(`hml-tenant-${store.key}-${index}`)},null,null,${quoteSql(created)}::timestamptz,null,${quoteSql(storeSubscriptionId(store.key))}::uuid,${quoteSql(status ?? "captured")},null)`);
    });
  }
  return rows;
}

function orderTotal(store: DemoStore, orderIndex: number): number {
  const product = store.products[orderIndex % store.products.length];
  if (!product) throw new Error(`produto de checkout ausente: ${store.key}/${orderIndex}`);
  const variant = product.variants[orderIndex % Math.max(product.variants.length, 1)] ?? null;
  const unit = variant?.priceCents ?? product.priceCents;
  const qty = 1 + (orderIndex % 2);
  const subtotal = unit * qty;
  const discount = orderIndex === 0 ? Math.floor(subtotal * 0.1) : 0;
  const shipping = orderIndex % 3 === 0 ? 1200 : 0;
  return subtotal - discount + shipping;
}

function storeCheckoutPaymentRows(anchor: string): string[] {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    for (let orderIndex = 0; orderIndex < 4; orderIndex += 1) {
      const total = orderTotal(store, orderIndex);
      const created = isoDaysFrom(anchor, -72 + orderIndex * 4);
      rows.push(`(${quoteSql(stableUuid(`payment:checkout:${store.key}:${orderIndex}`))}::uuid,'store_checkout',${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(storeGatewayId(store.key))}::uuid,${quoteSql(`hml-internal-checkout-${store.key}-${orderIndex}`)},${total},'BRL','captured',${quoteSql(created)}::timestamptz,null,null,null,null,${quoteSql(created)}::timestamptz,null,null,null,${quoteSql(stableUuid(`${store.key}:order:${orderIndex}`))}::uuid)`);
    }
  }
  return rows;
}

export function buildBillingSql(preflight: PreflightResult, config: HomologationRuntimeConfig): string {
  const anchor = config.anchorIso ?? DEFAULT_ANCHOR_ISO;
  const invoices = [...platformInvoices(config, anchor), ...tenantInvoices(config, anchor)];
  const payments = [...platformPaymentRows(config, anchor), ...tenantPaymentRows(config, anchor), ...storeCheckoutPaymentRows(anchor)];
  const tenantPlanIds = DEMO_STORES.map((store) => `${quoteSql(tenantPlanIdFor(store.tenantKey, config.storePlans[store.key].templateCode))}::uuid`).join(",");
  return `
insert into public.tenant_plans(id,tenant_id,template_id,slug,name,description,price_cents,billing_interval,active,trial_enabled,trial_days,display_order,recommended,created_at,updated_at) values ${tenantPlanRows(preflight, config, anchor)};
insert into public.tenant_plan_entitlements(tenant_id,tenant_plan_id,entitlement_key,enabled,limit_value)
select p.tenant_id,p.id,e.entitlement_key,e.enabled,e.limit_value from public.tenant_plans p join public.plan_template_entitlements e on e.template_id=p.template_id where p.id in (${tenantPlanIds});
insert into public.subscriptions(id,level,tenant_id,plan_id,status,created_at,started_at,trial_started_at,trial_ends_at,current_period_started_at,current_period_ends_at,canceled_at,updated_at) values ${platformSubscriptionRows(preflight.platformPlanId, anchor)};
insert into public.store_subscriptions(id,level,tenant_id,store_id,tenant_plan_id,status,started_at,trial_started_at,trial_ends_at,current_period_started_at,current_period_ends_at,canceled_at,created_at,updated_at) values ${storeSubscriptionRows(config, anchor)};
insert into public.gateway_accounts(id,level,tenant_id,store_id,provider,label,public_identifier,status,created_at,updated_at) values ${gatewayRows(anchor)};
insert into public.billing_invoices(id,level,tenant_id,store_id,period_start,period_end,subtotal_cents,total_cents,currency,status,external_invoice_id,due_at,paid_at,created_at,updated_at) values ${invoiceRows(invoices, anchor)};
insert into public.billing_events(id,level,tenant_id,store_id,invoice_id,event_type,quantity,unit_cents,total_cents,currency,period_start,period_end,status,idempotency_key,metadata,created_at) values ${billingEventRows(invoices)};
insert into public.payments(id,level,tenant_id,store_id,gateway_account_id,provider_payment_id,amount_cents,currency,status,created_at,subscription_id,idempotency_key,provider_create_started_at,platform_effect_status,updated_at,provider_updated_at,store_subscription_id,tenant_effect_status,order_id) values ${payments.join(",\n")};`;
}
