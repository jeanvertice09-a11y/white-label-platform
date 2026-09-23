import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("payment provider server boundary", () => {
  test("entrypoint público não exporta adapters, vault ou gateway loader", () => {
    const entry = source("packages/payments/src/index.ts");
    expect(entry).not.toContain("credential-vault");
    expect(entry).not.toContain("gateway-provider");
    expect(entry).not.toContain("providers/mercadopago");
    expect(entry).not.toContain("providers/asaas");
  });

  test("endpoint não serializa credencial, webhook secret ou ciphertext", () => {
    const endpoint = source("apps/web/src/lib/server/payment-webhook.server.ts");
    expect(endpoint).not.toContain("credentials_ciphertext");
    expect(endpoint).not.toContain("webhook_secret_ciphertext");
    expect(endpoint).not.toContain("Authorization");
  });

  test("worker não registra erros contendo material do provider", () => {
    const worker = source("apps/worker/src/index.ts");
    expect(worker).not.toContain("console.error(error");
    expect(worker).not.toContain("access_token");
    expect(worker).not.toContain("webhook secret");
  });
});


describe("store checkout payment lifecycle", () => {
  test("captured store payment confirms order and consumes inventory", () => {
    const store = source("packages/payments/src/server/store-checkout-lifecycle.sql.ts");
    expect(store).toContain("c.status='captured' and ol.status='pending'");
    expect(store).toContain("then 'confirmed'");
    expect(store).toContain("'Pagamento aprovado','sale','order'");
    expect(store).toContain("current_quantity<qty");
  });

  test("failed chargeback or refunded payment cancels open order and restores consumed inventory", () => {
    const store = source("packages/payments/src/server/store-checkout-lifecycle.sql.ts");
    expect(store).toContain("c.status in ('failed','chargeback','refunded')");
    expect(store).toContain("then 'cancelled'");
    expect(store).toContain("'Pagamento cancelado/reembolsado','cancellation','order'");
    expect(store).toContain("order.payment_transition");
  });

  test("stock effects remain idempotent by order reference", () => {
    const store = source("packages/payments/src/server/store-checkout-lifecycle.sql.ts");
    expect(store.match(/on conflict do nothing/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(store).toContain("reference_type,reference_id");
  });
});
