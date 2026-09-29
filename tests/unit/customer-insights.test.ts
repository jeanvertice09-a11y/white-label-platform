import { describe, expect, test } from "bun:test";
import { loadMerchantCustomerInsights } from "../../apps/web/src/lib/server/customer-insights.functions.ts";

const TENANT_ID = "11111111-1111-4111-a111-111111111111";
const STORE_ID = "22222222-2222-4222-a222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-a333-333333333333";

describe("merchant customer insights", () => {
  test("calcula métricas e histórico agregado apenas no escopo da loja", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const result = await loadMerchantCustomerInsights({
      query(sql, params = []) {
        queries.push({ sql, params });
        if (sql.includes("from public.customers c")) return Promise.resolve([{ customer_id: CUSTOMER_ID, completed_orders: 3, total_spent_cents: 30000, average_ticket_cents: 10000, first_purchase_at: "2026-07-01T10:00:00Z", last_purchase_at: "2026-09-01T10:00:00Z", recency_days: 20, average_days_between_purchases: 31 }]);
        return Promise.resolve([{ product_id: "44444444-4444-4444-a444-444444444444", product_name: "Produto A", quantity: 5, sales_cents: 18000, order_count: 2, last_purchased_at: "2026-09-01T10:00:00Z" }]);
      },
    }, { tenantId: TENANT_ID, storeId: STORE_ID }, CUSTOMER_ID);

    expect(result.completedOrders).toBe(3);
    expect(result.averageTicketCents).toBe(10000);
    expect(result.firstPurchaseAt).toContain("2026-07-01");
    expect(result.recencyDays).toBe(20);
    expect(result.averageDaysBetweenPurchases).toBe(31);
    expect(result.products[0]?.quantity).toBe(5);
    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect(query.sql).toContain("tenant_id=$1");
      expect(query.sql).toContain("store_id=$2");
      expect(query.params).toEqual([TENANT_ID, STORE_ID, CUSTOMER_ID]);
    }
  });

  test("não converte cliente inexistente em métricas zeradas", async () => {
    let message = "";
    try {
      await loadMerchantCustomerInsights({
        query() {
          return Promise.resolve([]);
        },
      }, { tenantId: TENANT_ID, storeId: STORE_ID }, CUSTOMER_ID);
    } catch (error) {
      message = error instanceof Error ? error.message : "erro desconhecido";
    }
    expect(message).toBe("Cliente não encontrado");
  });
});
