import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const lifecycle = readFileSync(join(ROOT, "packages/payments/src/server/store-checkout-lifecycle.sql.ts"), "utf8");

describe("store checkout stock conflict integrity", () => {
  test("records captured provider money even when stock can no longer be fulfilled", () => {
    expect(lifecycle).toContain("when c.status='captured' then 'paid'");
    expect(lifecycle).toContain("when c.status='captured' and ol.status='pending' and not sg.ok then 'cancelled'");
    expect(lifecycle).not.toContain("and (c.status<>'captured' or ol.status<>'pending' or sg.ok)");
  });

  test("never decrements stock for a cancelled stock-conflict order", () => {
    expect(lifecycle).toContain("where g.ok and oc.payment_status='captured' and oc.status='confirmed'");
    expect(lifecycle).toContain("when c.status='captured' and ol.status='pending' and sg.ok then coalesce(o.confirmed_at,now())");
  });

  test("leaves an auditable refund-required signal for paid stock conflicts", () => {
    expect(lifecycle).toContain("'order.payment_stock_conflict'");
    expect(lifecycle).toContain("'requires_refund',true");
    expect(lifecycle).toContain("jsonb_build_object('from',previous_status,'to',status,'payment_status',payment_status)");
  });
});
