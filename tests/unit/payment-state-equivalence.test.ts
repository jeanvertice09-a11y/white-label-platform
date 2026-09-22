import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { canAdvancePaymentStatus } from "../../packages/payments/src/server/status.ts";
import type { PaymentStatus } from "../../packages/payments/src/types.ts";

const storeSource = readFileSync(new URL("../../packages/payments/src/server/webhook-store.ts", import.meta.url), "utf8");
const statuses: PaymentStatus[] = ["pending", "authorized", "captured", "failed", "refunded", "chargeback"];
const allowed: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["authorized", "captured", "failed", "refunded", "chargeback"],
  authorized: ["captured", "failed", "refunded", "chargeback"],
  captured: ["refunded", "chargeback"],
  failed: [],
  refunded: [],
  chargeback: [],
};

describe("payment state TS x SQL invariants", () => {
  test("TypeScript preserva exatamente a matriz canônica e idempotência", () => {
    for (const current of statuses) {
      for (const next of statuses) {
        const expected = current === next || allowed[current].includes(next);
        expect(canAdvancePaymentStatus(current, next)).toBe(expected);
      }
    }
  });

  test("proteção SQL replica todas as transições não-idempotentes canônicas", () => {
    expect(storeSource).toContain("(status='pending' and $3 in ('authorized','captured','failed','refunded','chargeback'))");
    expect(storeSource).toContain("(status='authorized' and $3 in ('captured','failed','refunded','chargeback'))");
    expect(storeSource).toContain("(status='captured' and $3 in ('refunded','chargeback'))");
    expect(storeSource).toContain("status is distinct from $3");
    expect(storeSource).not.toContain("status='failed' and $3");
    expect(storeSource).not.toContain("status='refunded' and $3");
    expect(storeSource).not.toContain("status='chargeback' and $3");
  });

  test("SQL também bloqueia evento fora de ordem e escopa a conta do gateway", () => {
    expect(storeSource).toContain("$4::timestamptz >= provider_updated_at");
    expect(storeSource).toContain("where id=$1::uuid and gateway_account_id=$2::uuid");
  });
});
