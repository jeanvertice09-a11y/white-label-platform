import { DomainResolver } from "@white-label/domains";
import type { DomainRecord, SqlExecutor } from "@white-label/domains";
import {
  isKataluuPublicHost,
  publicCanonicalUrl,
  tenantCanRenderPublicSite,
  tenantPanelLoginUrl,
  unresolvedDomainState,
} from "../public-site.policy.ts";
import type {
  PublicBrand,
  PublicLoginExperience,
  PublicSiteExperience,
} from "../public-site.types.ts";
import { normalizeRoutingHost, systemTargetForHost } from "../routing-targets.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createServiceDomainStore } from "./supabase-domain-store.server.ts";

const KATALUU_BRAND: PublicBrand = { name: "Kataluu", logoUrl: null, primaryColor: "#111318" };
type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function tenantPublicRow(sql: SqlExecutor, tenantId: string): Promise<Row | null> {
  const rows = await sql.query(
    `select t.name,t.status,b.logo_url,b.primary_color,
       (select d.hostname from public.domains d
        where d.tenant_id=t.id and d.type='tenant_panel' and d.status='active'
          and d.verified_at is not null order by d.created_at asc limit 1) login_hostname
     from public.tenants t
     left join public.tenant_branding b on b.tenant_id=t.id
     where t.id=$1::uuid limit 1`,
    [tenantId],
  );
  return rows[0] ?? null;
}

function brandFromRow(row: Row): PublicBrand {
  return {
    name: text(row, "name"),
    logoUrl: nullableText(row, "logo_url"),
    primaryColor: nullableText(row, "primary_color"),
  };
}

async function unresolvedState(sql: SqlExecutor, host: string): Promise<PublicSiteExperience> {
  const rows = await sql.query(
    `select status,verified_at::text from public.domains
     where hostname=$1 order by created_at desc limit 1`,
    [host],
  );
  const row = rows[0];
  if (!row) return { kind: "state", state: "unknown" };
  return {
    kind: "state",
    state: unresolvedDomainState(nullableText(row, "status"), nullableText(row, "verified_at")),
  };
}

async function whiteLabelSite(
  sql: SqlExecutor,
  host: string,
  resolved: DomainRecord,
): Promise<PublicSiteExperience> {
  if (resolved.type !== "tenant_site") return { kind: "state", state: "unknown" };
  const row = await tenantPublicRow(sql, resolved.tenantId);
  if (!row || !tenantCanRenderPublicSite(text(row, "status"))) {
    return { kind: "state", state: "unavailable" };
  }
  const brand = brandFromRow(row);
  if (!brand.name) return { kind: "state", state: "unavailable" };
  return {
    kind: "white_label",
    brand,
    canonicalUrl: publicCanonicalUrl(host),
    loginUrl: tenantPanelLoginUrl(nullableText(row, "login_hostname")),
  };
}

export async function loadPublicSite(rawHost: string | null): Promise<PublicSiteExperience> {
  const host = normalizeRoutingHost(rawHost);
  if (isKataluuPublicHost(host)) return { kind: "kataluu", canonicalUrl: publicCanonicalUrl(host) };
  const sql = createAdminSqlExecutor();
  const resolved = await new DomainResolver(createServiceDomainStore()).resolve(host);
  if (!resolved) return unresolvedState(sql, host);
  return whiteLabelSite(sql, host, resolved);
}

export async function loadPublicLoginExperience(rawHost: string | null): Promise<PublicLoginExperience> {
  const host = normalizeRoutingHost(rawHost);
  if (systemTargetForHost(host) !== undefined || isKataluuPublicHost(host)) {
    return { brand: KATALUU_BRAND, tenantBranded: false, available: true, panelLoginUrl: null };
  }
  const resolved = await new DomainResolver(createServiceDomainStore()).resolve(host);
  if (!resolved) return { brand: KATALUU_BRAND, tenantBranded: false, available: false, panelLoginUrl: null };
  const row = await tenantPublicRow(createAdminSqlExecutor(), resolved.tenantId);
  if (!row) return { brand: KATALUU_BRAND, tenantBranded: false, available: false, panelLoginUrl: null };
  return {
    brand: brandFromRow(row),
    tenantBranded: true,
    available: tenantCanRenderPublicSite(text(row, "status")),
    panelLoginUrl: tenantPanelLoginUrl(nullableText(row, "login_hostname")),
  };
}
