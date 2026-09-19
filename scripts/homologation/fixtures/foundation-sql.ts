import { DEMO_STORES, DEMO_TENANTS } from "./data.ts";
import type { HomologationMediaMode, HomologationRuntimeConfig } from "../model.ts";
import { DEFAULT_ANCHOR_ISO, isoDaysFrom, quoteSql, requireStoreDomain, stableUuid } from "../model.ts";

function json(value: unknown): string {
  return `${quoteSql(JSON.stringify(value))}::jsonb`;
}

function tenantRows(anchor: string): string {
  return DEMO_TENANTS.map((tenant, index) => {
    const created = isoDaysFrom(anchor, -88 + index * 3);
    return `(${quoteSql(tenant.id)}::uuid,${quoteSql(tenant.slug)},${quoteSql(tenant.name)},'active',${quoteSql(created)}::timestamptz,${quoteSql(anchor)}::timestamptz)`;
  }).join(",\n");
}

function storeRows(anchor: string): string {
  return DEMO_STORES.map((store, index) => {
    const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
    if (!tenant) throw new Error(`tenant ausente: ${store.tenantKey}`);
    const created = isoDaysFrom(anchor, -80 + index * 4);
    return `(${quoteSql(store.id)}::uuid,${quoteSql(tenant.id)}::uuid,${quoteSql(store.slug)},${quoteSql(store.name)},'active',${quoteSql(created)}::timestamptz,${quoteSql(anchor)}::timestamptz)`;
  }).join(",\n");
}

function domainRows(config: HomologationRuntimeConfig, anchor: string): string {
  const rows: string[] = [];
  for (const tenant of DEMO_TENANTS) {
    const domain = config.domains[tenant.key];
    rows.push(`(${quoteSql(stableUuid(`domain:${tenant.key}:site`))}::uuid,${quoteSql(tenant.id)}::uuid,null,${quoteSql(domain.tenantSite)},'tenant_site','active',null,${quoteSql(anchor)}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
    rows.push(`(${quoteSql(stableUuid(`domain:${tenant.key}:panel`))}::uuid,${quoteSql(tenant.id)}::uuid,null,${quoteSql(domain.tenantPanel)},'tenant_panel','active',null,${quoteSql(anchor)}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
    for (const store of DEMO_STORES.filter((item) => item.tenantKey === tenant.key)) {
      const storeDomain = requireStoreDomain(config, tenant.key, store.key);
      rows.push(`(${quoteSql(stableUuid(`domain:${store.key}:admin`))}::uuid,${quoteSql(tenant.id)}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(storeDomain.admin)},'store_admin','active',null,${quoteSql(anchor)}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
      rows.push(`(${quoteSql(stableUuid(`domain:${store.key}:catalog`))}::uuid,${quoteSql(tenant.id)}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(storeDomain.catalog)},'store_catalog','active',null,${quoteSql(anchor)}::timestamptz,${quoteSql(anchor)}::timestamptz)`);
    }
  }
  return rows.join(",\n");
}

export function buildFoundationSql(
  config: HomologationRuntimeConfig,
  mediaMode: HomologationMediaMode = "required",
): string {
  const anchor = config.anchorIso ?? DEFAULT_ANCHOR_ISO;
  const branding = DEMO_TENANTS.map((tenant) => {
    const logo = mediaMode === "deferred" ? "null" : quoteSql(config.tenantLogoUrls[tenant.key]);
    return `(${quoteSql(tenant.id)}::uuid,${logo},${quoteSql(tenant.primaryColor)},${quoteSql(anchor)}::timestamptz)`;
  }).join(",\n");
  const tenantSettings = DEMO_TENANTS.map((tenant) => `(${quoteSql(tenant.id)}::uuid,${json({ demoSeed: true, companyName: tenant.companyName, environment: "homologation", contactEmail: `contato+${tenant.key}@example.test` })},${quoteSql(anchor)}::timestamptz)`).join(",\n");
  const tenantMembers = DEMO_TENANTS.map((tenant) => `(${quoteSql(tenant.id)}::uuid,${quoteSql(config.tenantOwners[tenant.key])}::uuid,'tenant_owner',${quoteSql(anchor)}::timestamptz)`).join(",\n");
  const storeMembers = DEMO_STORES.map((store) => {
    const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
    if (!tenant) throw new Error(`tenant ausente: ${store.tenantKey}`);
    return `(${quoteSql(tenant.id)}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(config.storeOwners[store.key])}::uuid,'store_owner',${quoteSql(anchor)}::timestamptz)`;
  }).join(",\n");
  const storeSettings = DEMO_STORES.map((store) => {
    const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
    if (!tenant) throw new Error(`tenant ausente: ${store.tenantKey}`);
    return `(${quoteSql(tenant.id)}::uuid,${quoteSql(store.id)}::uuid,${json({ demoSeed: true, environment: "homologation", segment: store.segment, description: store.description, contactEmail: `loja+${store.key}@example.test`, whatsapp: store.whatsapp })},${quoteSql(anchor)}::timestamptz)`;
  }).join(",\n");
  const audits = DEMO_STORES.map((store) => {
    const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
    if (!tenant) throw new Error(`tenant ausente: ${store.tenantKey}`);
    return `(${quoteSql(stableUuid(`audit:${store.key}:seed`))}::uuid,${quoteSql(config.storeOwners[store.key])}::uuid,${quoteSql(tenant.id)}::uuid,${quoteSql(store.id)}::uuid,'homologation.seed.created','store',${quoteSql(store.id)},${json({ demoSeed: true, version: "v1" })},${quoteSql(anchor)}::timestamptz)`;
  }).join(",\n");
  return `
insert into public.tenants(id,slug,name,status,created_at,updated_at) values ${tenantRows(anchor)};
insert into public.tenant_branding(tenant_id,logo_url,primary_color,created_at) values ${branding};
insert into public.tenant_settings(tenant_id,settings,updated_at) values ${tenantSettings};
insert into public.tenant_members(tenant_id,user_id,role,created_at) values ${tenantMembers};
insert into public.stores(id,tenant_id,slug,name,status,created_at,updated_at) values ${storeRows(anchor)};
insert into public.store_members(tenant_id,store_id,user_id,role,created_at) values ${storeMembers};
insert into public.store_settings(tenant_id,store_id,settings,updated_at) values ${storeSettings};
insert into public.domains(id,tenant_id,store_id,hostname,type,status,verification_token,verified_at,created_at) values ${domainRows(config, anchor)};
insert into public.audit_logs(id,actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata,created_at) values ${audits};`;
}
