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
