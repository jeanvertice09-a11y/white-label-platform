import { describe, expect, test } from "bun:test";
import { listSuppliers } from "../../packages/merchant-ops/src/suppliers.ts";

const TENANT_ID = "11111111-1111-4111-a111-111111111111";
const STORE_ID = "22222222-2222-4222-a222-222222222222";

describe("merchant supplier stats", () => {
  test("agrega somente compras recebidas no mesmo tenant/store", async () => {
    let capturedSql = "";
    let capturedParams: unknown[] = [];
    const page = await listSuppliers({
      query(sql, params = []) {
        capturedSql = sql; capturedParams = params;
        return Promise.resolve([{
          id: "33333333-3333-4333-a333-333333333333", name: "Fornecedor A", trade_name: null, document: null, contact_name: null,
          phone: null, whatsapp: null, email: null, address: null, notes: null, status: "active",
          received_purchases: 3, received_total_cents: 12500, last_received_purchase_at: "2026-09-18",
          created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-09-18T00:00:00.000Z", total_count: 1,
        }]);
      },
    }, { tenantId: TENANT_ID, storeId: STORE_ID }, { page: 1, pageSize: 25 });
    expect(page.items[0]?.receivedPurchases).toBe(3);
    expect(page.items[0]?.receivedTotalCents).toBe(12500);
    expect(page.items[0]?.lastReceivedPurchaseAt).toBe("2026-09-18");
    expect(capturedSql).toContain("p.tenant_id=s.tenant_id and p.store_id=s.store_id");
    expect(capturedSql).toContain("p.status='received'");
    expect(capturedSql).not.toContain("p.status='draft'");
    expect(capturedSql).not.toContain("p.status='cancelled'");
    expect(capturedParams.slice(0, 2)).toEqual([TENANT_ID, STORE_ID]);
  });
});
