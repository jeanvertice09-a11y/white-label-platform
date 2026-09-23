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


describe("store admin production authentication boundary", () => {
  test("admin context uses authenticated RPC instead of service-role domain resolution", () => {
    const contextFunctions = source("apps/web/src/lib/server/context.functions.ts");
    const routeContext = source("apps/web/src/lib/server/route-context.server.ts");
    const migration = source("supabase/migrations/0041_authenticated_store_admin_resolution.sql");

    expect(contextFunctions).toContain("createStoreAdminRequestDeps()");
    expect(routeContext).toContain('client.rpc("resolve_my_store_admin_domain"');
    expect(migration).toContain("sm.user_id = auth.uid()");
    expect(migration).toContain("grant execute on function public.resolve_my_store_admin_domain(text) to authenticated");
    expect(migration).toContain("d.type = 'store_admin'");
  });
});


describe("HML authentication flow", () => {
  test("password login does not force TOTP enrollment while HML MFA is disabled", () => {
    const login = source("apps/web/src/routes/login.tsx");
    const context = source("apps/web/src/lib/server/route-context.server.ts");
    const mfa = source("apps/web/src/routes/mfa.tsx");

    expect(login).not.toContain("/mfa?next=");
    expect(login).toContain("window.location.assign(next)");
    expect(context).toContain("Intentionally disabled during HML");
    expect(mfa).not.toContain("auth.mfa.enroll");
    expect(mfa).not.toContain("challengeAndVerify");
  });
});


describe("HML admin runtime contracts", () => {
  test("orders loader never exceeds catalog product page-size limit", () => {
    const orders = source("apps/web/src/routes/admin.orders.index.tsx");
    const catalog = source("apps/web/src/lib/server/catalog.functions.ts");
    expect(catalog).toContain("max(48)");
    expect(orders).toContain('pageSize: 48, sort: "name"');
    expect(orders).not.toContain("pageSize: 100");
  });

  test("unconfigured Mercado Pago is a disabled capability, not a leaked env error", () => {
    const oauth = source("apps/web/src/lib/server/mercadopago-oauth.functions.ts");
    const card = source("apps/web/src/features/store-admin/mercadopago-connect-card.tsx");
    expect(oauth).toContain("oauthAvailability()");
    expect(oauth).toContain("Integração Mercado Pago indisponível neste ambiente.");
    expect(card).toContain("disabled={busy||!props.available}");
    expect(card).not.toContain("cause.message");
  });
});


describe("product nested route rendering", () => {
  test("products parent renders an Outlet and list lives in the index child", () => {
    const parent = source("apps/web/src/routes/admin.products.tsx");
    const index = source("apps/web/src/routes/admin.products.index.tsx");
    expect(parent).toContain("Outlet");
    expect(parent).toContain("return <Outlet />");
    expect(index).toContain('createFileRoute("/admin/products/")');
    expect(index).toContain("<ProductsList");
  });
});


describe("admin request-context performance boundary", () => {
  test("merchant catalog and operations do not repeat service-role domain resolution", () => {
    const catalogContext = source("apps/web/src/lib/server/catalog-context.server.ts");
    const operationsContext = source("apps/web/src/lib/server/operations-context.server.ts");
    expect(catalogContext).toContain("createStoreAdminRequestDeps");
    expect(operationsContext).toContain("createStoreAdminRequestDeps");
    expect(catalogContext).not.toContain("createRealDeps");
    expect(operationsContext).not.toContain("createRealDeps");
  });

  test("all nested admin route parents render outlets", () => {
    for (const file of [
      "apps/web/src/routes/admin.customers.tsx",
      "apps/web/src/routes/admin.orders.tsx",
      "apps/web/src/routes/admin.products.tsx",
      "apps/web/src/routes/admin.store.tsx",
    ]) {
      expect(source(file)).toContain("Outlet");
    }
  });
});


describe("merchant admin visual and navigation contract", () => {
  test("admin uses a white modern workspace and indigo interaction palette", () => {
    const css = source("apps/web/src/styles/admin-kataluu-redesign.css");
    expect(css).toContain("--merchant-bg:#fff");
    expect(css).toContain("--merchant-accent:#4f46e5");
    expect(css).toContain('"Segoe UI Variable"');
    expect(css).toContain(".k-dashboard-layout");
  });

  test("completed onboarding does not dominate the operational dashboard", () => {
    const dashboard = source("apps/web/src/routes/admin.index.tsx");
    expect(dashboard).toContain("data.onboarding.progress.percent < 100");
    expect(dashboard.indexOf("<DashboardStrip")).toBeLessThan(dashboard.indexOf("<AttentionSection"));
  });

  test("onboarding actions use SPA navigation instead of document reloads", () => {
    const onboarding = source("apps/web/src/features/store-admin/onboarding-checklist.tsx");
    expect(onboarding).toContain('import { Link } from "@tanstack/react-router"');
    expect(onboarding).not.toContain("href={step.href}");
  });
});


describe("store payment lifecycle operations", () => {
  test("order detail exposes its store-scoped payment state", () => {
    const orders = source("apps/web/src/lib/server/operations-orders.functions.ts");
    expect(orders).toContain("getStoreOrderPayment(current.scope, data.id)");
    expect(orders).toContain("return { order, timeline, payment }");
  });

  test("refund is restricted to captured store-checkout payments and audited", () => {
    const payment = source("apps/web/src/lib/server/mercadopago-store-payment.server.ts");
    const orders = source("apps/web/src/lib/server/operations-orders.functions.ts");
    expect(payment).toContain("p.level='store_checkout'");
    expect(payment).toContain('row["status"]!=="captured"');
    expect(payment).toContain("provider.refund");
    expect(orders).toContain("payment.refund_requested");
  });

  test("merchant refund uses provider idempotency", () => {
    const payment = source("apps/web/src/lib/server/mercadopago-store-payment.server.ts");
    expect(payment).toContain("refund-order-");
  });
});


describe("public Pix lifecycle", () => {
  test("payment polling is bound to store, order and checkout idempotency key", () => {
    const checkout = source("apps/web/src/lib/server/storefront-checkout.functions.ts");
    expect(checkout).toContain("id=$3::uuid and idempotency_key=$4 and origin='online'");
    expect(checkout).toContain("getStoreOrderPayment(catalog.scope,data.orderId)");
  });

  test("Pix confirmation polls payment status without exposing gateway credentials", () => {
    const cart = source("apps/web/src/features/storefront/cart-panel.tsx");
    expect(cart).toContain("getOnlinePixOrderStatus");
    expect(cart).toContain("window.setInterval");
    expect(cart).toContain("Pagamento confirmado");
  });

  test("checkout payment failures are auditable without provider error payloads", () => {
    const checkout = source("apps/web/src/lib/server/storefront-checkout.functions.ts");
    expect(checkout).toContain("checkout.payment_creation_failed");
    expect(checkout).toContain("checkout.payment_data_missing");
  });
});


describe("merchant shipping operations", () => {
  test("settings exposes Melhor Envio as a first-class merchant integration", () => {
    const settings = source("apps/web/src/routes/admin.settings.tsx");
    expect(settings).toContain("getMelhorEnvioSettings()");
    expect(settings).toContain("<MelhorEnvioCard");
  });
  test("shipment actions remain tenant/store scoped and audited", () => {
    const shipping = source("apps/web/src/lib/server/melhor-envio.functions.ts");
    expect(shipping).toContain("tenant_id=$1::uuid and store_id=$2::uuid and order_id=$3::uuid");
    expect(shipping).toContain("shipping.label_generated");
  });
});


describe("end-to-end logistics", () => {
 test("Melhor Envio OAuth has a real callback completion route",()=>{const route=source("apps/web/src/routes/oauth.melhor-envio.callback.tsx"),fn=source("apps/web/src/lib/server/melhor-envio.functions.ts");expect(route).toContain("completeMelhorEnvioConnection");expect(fn).toContain("finishMelhorEnvioOAuth");});
 test("checkout collects a complete shipping recipient instead of blank address fields",()=>{const cart=source("apps/web/src/features/storefront/cart-panel.tsx");expect(cart).toContain("Endereço de entrega");expect(cart).toContain("document:recipientDocument,address:address.trim(),number:number.trim()");expect(cart).not.toContain('document:"",address:"",number:""');});
 test("merchant can configure dispatch and operate a paid order shipment",()=>{const card=source("apps/web/src/features/store-admin/melhor-envio-card.tsx"),order=source("apps/web/src/routes/admin.orders.$id.tsx");expect(card).toContain("saveMelhorEnvioProfile");expect(order).toContain("generateOrderShipment");expect(order).toContain("Abrir etiqueta");});
});


describe("automatic operational recovery",()=>{
 test("worker schedules store payment and shipment recovery with scoped idempotency",()=>{const scheduler=source("apps/worker/src/jobs/scheduler.ts");expect(scheduler).toContain('kind:"store_payment.reconcile"');expect(scheduler).toContain('kind:"shipment.recover"');expect(scheduler).toContain("p.tenant_id::text,p.store_id::text");});
 test("worker reconciles store checkout payment through its scoped gateway",()=>{const handlers=source("apps/worker/src/jobs/handlers.ts");expect(handlers).toContain('loaded.level!=="store_checkout"');expect(handlers).toContain("reconcileStorePayment");});
 test("merchant dashboard surfaces retry and dead-letter recovery alerts",()=>{const server=source("apps/web/src/lib/server/operations-dashboard.functions.ts"),ui=source("apps/web/src/routes/admin.index.tsx");expect(server).toContain("RECOVERY_ALERTS_SQL");expect(server).toContain("'retry','dead_letter'");expect(ui).toContain("Recuperação automática");expect(ui).toContain("Pendências técnicas");});
});
