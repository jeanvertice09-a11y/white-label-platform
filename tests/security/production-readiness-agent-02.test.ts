import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
function source(path: string): string { return readFileSync(join(ROOT, path), "utf8"); }

const analyticsSource = readFileSync(new URL("../../apps/web/src/lib/server/storefront-analytics.functions.ts", import.meta.url), "utf8");
const trackingSource = readFileSync(new URL("../../apps/web/src/features/storefront/storefront-tracking.tsx", import.meta.url), "utf8");
const exportSource = readFileSync(new URL("../../apps/web/src/lib/server/data-export.functions.ts", import.meta.url), "utf8");
const healthSource = readFileSync(new URL("../../apps/web/src/lib/server/control-operational-health.functions.ts", import.meta.url), "utf8");
const domainContext = readFileSync(new URL("../../apps/web/src/lib/server/route-context.server.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../../supabase/migrations/0028_production_readiness.sql", import.meta.url), "utf8");

describe("production readiness agent 02 boundaries", () => {
  test("analytics público resolve escopo pelo hostname e não aceita tenant/store no schema", () => {
    const schema = analyticsSource.slice(analyticsSource.indexOf("const eventSchema"), analyticsSource.indexOf("const dateSchema"));
    expect(schema).not.toContain("tenantId");
    expect(schema).not.toContain("storeId");
    expect(analyticsSource).toContain("createPublicCatalogContext(getRequestHost())");
    expect(analyticsSource).toContain("where tenant_id=$1::uuid and store_id=$2::uuid and id=$3::uuid");
  });

  test("order analytics usa total autoritativo do banco", () => {
    expect(analyticsSource).toContain("select id::text,total_cents from public.orders");
    expect(analyticsSource).toContain("valueCents: value");
    expect(trackingSource).toContain("recordStorefrontAnalytics({ data: payload })");
  });

  test("migration de analytics é RLS deny-by-default e sem campos de PII", () => {
    expect(migrationSource).toContain("alter table public.storefront_analytics_events enable row level security");
    expect(migrationSource).not.toContain("create policy");
    expect(migrationSource).not.toContain("ip inet");
    expect(migrationSource).not.toContain("user_agent text");
    expect(migrationSource).not.toContain("payload jsonb");
  });

  test("exportação resolve contexto no servidor, exige owner/admin e não toca segredos/gateway", () => {
    expect(exportSource).toContain("loadStoreAdmin({ host: getRequestHost() }, deps)");
    expect(exportSource).toContain('requireStoreRole({ storeRoles: auth.storeRoles }, "store_owner", "store_admin")');
    expect(exportSource).not.toContain("validator(");
    expect(exportSource).not.toContain("gateway_accounts");
    expect(exportSource).not.toContain("gateway_account_secrets");
    expect(exportSource).not.toContain("credentials_ciphertext");
    expect(exportSource).not.toContain("webhook_secret_ciphertext");
    expect(exportSource).toContain("ROW_LIMIT = 5_000");
    expect(exportSource).toContain("TOTAL_ROW_LIMIT = 20_000");
  });

  test("observabilidade de control permanece tenant scoped", () => {
    expect(healthSource).toContain("controlMerchantRead()");
    expect(healthSource).toContain("where g.tenant_id=$1::uuid");
    expect(healthSource).toContain("where p.tenant_id=$1::uuid");
    expect(healthSource).toContain("from public.domains where tenant_id=$1::uuid");
  });

  test("produção continua sem injetar cache de domínio em memória", () => {
    expect(domainContext).toContain("new DomainResolver(createServiceDomainStore())");
    expect(domainContext).not.toContain("new InMemoryDomainCache");
  });
});


describe("Vercel production configuration", () => {
  test("keeps a single authoritative vercel.json with baseline security headers", () => {
    const root = source("vercel.json");
    expect(root).toContain('"framework": "tanstack-start"');
    expect(root).toContain("Content-Security-Policy");
    expect(root).toContain("X-Frame-Options");
    expect(root).toContain("Strict-Transport-Security");
    expect(existsSync(join(ROOT, "apps/web/vercel.json"))).toBe(false);
  });

  test("admin dashboard emits structured telemetry for partial loader failures", () => {
    const dashboard = source("apps/web/src/routes/admin.index.tsx");
    expect(dashboard).toContain("admin.dashboard.partial_failure");
    expect(dashboard).toContain("durationMs");
  });
});


describe("SSR dependency boundary", () => {
  test("React is not force-inlined into the Vite SSR module runner", () => {
    const vite = source("apps/web/vite.config.ts");
    expect(vite).not.toContain('"react",');
    expect(vite).not.toContain('"react-dom",');
  });
});


describe("browser production smoke boundary", () => {
  test("Playwright exercises the built web server", () => {
    const playwright = source("playwright.config.ts");
    expect(playwright).toContain("bun run --cwd apps/web preview");
    expect(playwright).toContain("port: 5173");
  });
});
