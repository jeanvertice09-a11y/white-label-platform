import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const sessionSource = read("../../apps/web/src/lib/server/supabase-server.server.ts");
const routeContextSource = read("../../apps/web/src/lib/server/route-context.server.ts");
const mfaSource = read("../../apps/web/src/routes/mfa.tsx");
const checkoutSource = read("../../apps/web/src/lib/server/storefront-checkout.functions.ts");
const webhookSource = read("../../apps/web/src/lib/server/payment-webhook.server.ts");
const webhookStoreSource = read("../../packages/payments/src/server/webhook-store.ts");
const lifecycleSource = read("../../packages/payments/src/server/store-checkout-lifecycle.sql.ts");
const asaasSource = read("../../packages/payments/src/server/providers/asaas.ts");
const mercadoPagoSource = read("../../packages/payments/src/server/providers/mercadopago.ts");
const migrationSource = read("../../supabase/migrations/0027_security_rate_limits.sql");
const vercelSource = read("../../vercel.json");

describe("security production hardening boundary", () => {
  test("HML mantém autenticação Supabase sem forçar enrollment MFA", () => {
    expect(sessionSource).toContain("getAuthenticatorAssuranceLevel()");
    expect(routeContextSource.match(/requireMfaAssurance\(session\);/g)?.length).toBe(3);
    expect(routeContextSource).toContain("Intentionally disabled during HML");
    expect(mfaSource).not.toContain("auth.mfa.enroll");
    expect(mfaSource).not.toContain("auth.mfa.challengeAndVerify");
    expect(mfaSource).not.toContain("totp.secret");
    expect(mfaSource).not.toContain("service_role");
  });

  test("rate limiter é persistente, atômico, fail-closed para browser e com chave server-side", () => {
    expect(migrationSource).toContain("create table if not exists public.security_rate_limits");
    expect(migrationSource).toContain("security definer");
    expect(migrationSource).toContain("on conflict (rate_key) do update");
    expect(migrationSource).toContain("enable row level security");
    expect(migrationSource).toContain("revoke all on function public.consume_security_rate_limit");
    expect(checkoutSource).toContain("`checkout:${catalog.scope.tenantId}:${catalog.scope.storeId}`");
    expect(webhookSource).toContain("`webhook:${providerName}:${gatewayAccountId}`");
  });

  test("webhook limita payload antes de materializar body e retorna 413/429 explicitamente", () => {
    expect(webhookSource).toContain("MAX_WEBHOOK_BODY_BYTES = 64 * 1024");
    expect(webhookSource).toContain(".getReader()");
    expect(webhookSource).toContain("total > maxBytes");
    expect(webhookSource).toContain('status: 413');
    expect(webhookSource).toContain('status: 429');
  });

  test("payment permanece preso ao gateway account e webhook é idempotente por conta", () => {
    expect(webhookStoreSource).toContain("where gateway_account_id=$1::uuid and provider_payment_id=$2");
    expect(lifecycleSource).toContain("public.payments.id=pc.id and public.payments.gateway_account_id=$2::uuid");
    expect(webhookStoreSource).toContain("on conflict (provider,gateway_account_id,external_event_id) do nothing");
    expect(lifecycleSource).toContain("$4::timestamptz >= public.payments.provider_updated_at");
  });

  test("refund inseguro Asaas continua fechado e Mercado Pago mantém idempotência", () => {
    expect(asaasSource).toContain("Refund Asaas desabilitado");
    expect(mercadoPagoSource).toContain("requireIdempotencyKey(input.idempotencyKey)");
    expect(mercadoPagoSource).toContain('"X-Idempotency-Key"');
  });

  test("headers defensivos incluem CSP compatível com storefront e Supabase", () => {
    expect(vercelSource).toContain("X-Content-Type-Options");
    expect(vercelSource).toContain("Referrer-Policy");
    expect(vercelSource).toContain("Permissions-Policy");
    expect(vercelSource).toContain("Content-Security-Policy");
    expect(vercelSource).toContain("connect-src 'self' https://*.supabase.co");
    expect(vercelSource).toContain("img-src 'self' data: https:");
    expect(vercelSource).toContain("frame-ancestors 'none'");
  });
});
