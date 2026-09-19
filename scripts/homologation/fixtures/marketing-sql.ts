import { DEMO_STORES, DEMO_TENANTS } from "./data.ts";
import type { DemoStore } from "../model.ts";
import { DEFAULT_ANCHOR_ISO, isoDaysFrom, quoteSql, stableUuid } from "../model.ts";

function tenantId(store: DemoStore): string {
  const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
  if (!tenant) throw new Error(`tenant ausente: ${store.tenantKey}`);
  return tenant.id;
}

function consentRows(anchor: string): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    for (let index = 0; index < 6; index += 1) {
      const optedIn = index < 4;
      const changedAt = isoDaysFrom(anchor, -50 + index * 4);
      rows.push(`(${quoteSql(stableUuid(`${store.key}:consent:${index}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(stableUuid(`${store.key}:customer:${index}`))}::uuid,${quoteSql(optedIn ? "opted_in" : "opted_out")},'homologation_seed',${optedIn ? `${quoteSql(changedAt)}::timestamptz` : "null"},${optedIn ? "null" : `${quoteSql(changedAt)}::timestamptz`},${quoteSql(changedAt)}::timestamptz)`);
    }
  }
  return rows.join(",\n");
}

function campaignRows(anchor: string): string {
  return DEMO_STORES.map((store, index) => {
    const scheduled = index % 2 === 1;
    const created = isoDaysFrom(anchor, -12 + index);
    const prepared = isoDaysFrom(created, 1);
    const scheduledAt = scheduled ? isoDaysFrom(anchor, 5 + index) : null;
    return `(${quoteSql(stableUuid(`${store.key}:campaign:main`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(`Clientes ativos — ${store.name}`)},${quoteSql(`Olá! Confira as novidades selecionadas para a homologação da ${store.name}.`)},${quoteSql(scheduled ? "scheduled" : "prepared")},'with_orders',${scheduledAt ? `${quoteSql(scheduledAt)}::timestamptz` : "null"},${quoteSql(prepared)}::timestamptz,null,${quoteSql(created)}::timestamptz,${quoteSql(prepared)}::timestamptz)`;
  }).join(",\n");
}

function recipientRows(anchor: string): string {
  const rows: string[] = [];
  for (const [storeIndex, store] of DEMO_STORES.entries()) {
    const campaignId = stableUuid(`${store.key}:campaign:main`);
    const scheduled = storeIndex % 2 === 1;
    const prepared = isoDaysFrom(anchor, -11 + storeIndex);
    const available = scheduled ? isoDaysFrom(anchor, 5 + storeIndex) : prepared;
    for (let customerIndex = 0; customerIndex < 3; customerIndex += 1) {
      rows.push(`(${quoteSql(stableUuid(`${store.key}:campaign:main:recipient:${customerIndex}`))}::uuid,${quoteSql(tenantId(store))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(campaignId)}::uuid,${quoteSql(stableUuid(`${store.key}:customer:${customerIndex}`))}::uuid,'queued','opted_in',${quoteSql(available)}::timestamptz,${quoteSql(prepared)}::timestamptz,null,${quoteSql(prepared)}::timestamptz)`);
    }
  }
  return rows.join(",\n");
}

export function buildMarketingSql(configAnchor?: string): string {
  const anchor = configAnchor ?? DEFAULT_ANCHOR_ISO;
  return `
insert into public.marketing_consents(id,tenant_id,store_id,customer_id,status,source,granted_at,revoked_at,updated_at) values ${consentRows(anchor)};
insert into public.marketing_campaigns(id,tenant_id,store_id,name,content,status,segment_type,scheduled_at,prepared_at,cancelled_at,created_at,updated_at) values ${campaignRows(anchor)};
insert into public.marketing_campaign_recipients(id,tenant_id,store_id,campaign_id,customer_id,status,consent_snapshot_status,available_at,prepared_at,blocked_at,updated_at) values ${recipientRows(anchor)};`;
}
