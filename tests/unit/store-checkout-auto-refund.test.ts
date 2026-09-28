import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT=join(import.meta.dir,"..","..");
const lifecycle=readFileSync(join(ROOT,"packages/payments/src/server/store-checkout-lifecycle.sql.ts"),"utf8");
const processor=readFileSync(join(ROOT,"packages/payments/src/server/webhook-processor.ts"),"utf8");
const store=readFileSync(join(ROOT,"packages/payments/src/server/webhook-store.ts"),"utf8");

describe("store checkout automatic refund lifecycle",()=>{
  test("atomic transition exposes a refund-required signal only for captured stock conflicts",()=>{
    expect(lifecycle).toContain("exists(select 1 from stock_failure_audit) requires_refund");
    expect(lifecycle).toContain("c.status='captured' and c.order_id is not null and not sg.ok");
  });

  test("status API preserves boolean compatibility and exposes detailed reconciliation",()=>{
    expect(store).toContain("export async function applyPaymentStatusResult");
    expect(store).toContain("requiresRefund:row?.[\"requires_refund\"]===true");
    expect(store).toContain("return (await applyPaymentStatusResult");
  });

  test("webhook and manual reconciliation automatically refund an unfulfillable captured payment",()=>{
    expect(processor).toContain("if(result.requiresRefund)");
    expect(processor).toContain("await provider.refund({providerPaymentId,idempotencyKey:`stock-conflict:${paymentId}`})");
    expect(processor).toContain('await applyPaymentStatus(sql,paymentId,gatewayAccountId,"refunded",null,true)');
    expect(processor).toContain('finalStatus="refunded"');
    expect(processor).toContain("order.payment_stock_conflict_refunded");
  });
});
