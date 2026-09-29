import { describe, expect, test } from "bun:test";
import { loadMerchantOperationalReport } from "../../apps/web/src/lib/server/merchant-reporting.functions.ts";

const TENANT_ID = "11111111-1111-4111-a111-111111111111";
const STORE_ID = "22222222-2222-4222-a222-222222222222";

describe("merchant reporting depth", () => {
  test("calcula ticket, produto, cliente e categorias com escopo tenant/store", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const report = await loadMerchantOperationalReport({
      query(sql, params = []) {
        queries.push({ sql, params });
        if (sql.includes("as completed_orders")) return Promise.resolve([{ completed_orders: 4, sales_cents: 20000, buyers: 2, customers: 5, active_products: 6, low_stock_products: 1, received_purchases: 2, received_purchases_total_cents: 7000, suppliers: 3, active_suppliers: 2, open_tasks: 1, completed_tasks: 2 }]);
        if (sql.includes("from public.merchant_financial_entries") && sql.includes("open_receivable")) return Promise.resolve([{ open_receivable: 9000, overdue_receivable: 1000, open_payable: 4000, overdue_payable: 500, received: 12000, paid: 7000, competence_receivable: 15000, competence_payable: 8000 }]);
        if (sql.includes("new_customers")) return Promise.resolve([{ new_customers: 2 }]);
        if (sql.includes("from public.order_items oi")) return Promise.resolve([{ product_id: "33333333-3333-4333-a333-333333333333", product_name: "Produto A", quantity_sold: 6, sales_cents: 12000, order_count: 3 }]);
        if (sql.includes("join public.customers c")) return Promise.resolve([{ customer_id: "44444444-4444-4444-a444-444444444444", customer_name: "Cliente A", order_count: 2, sales_cents: 15000, last_purchase_at: "2026-09-20T12:00:00Z" }]);
        if (sql.includes("group by e.category_id")) return Promise.resolve([{ category_id: null, category_name: "Sem categoria", direction: "payable", entry_count: 2, amount_cents: 3000 }]);
        throw new Error("Query inesperada");
      },
    }, { tenantId: TENANT_ID, storeId: STORE_ID }, "2026-09-01", "2026-09-30");

    expect(report.averageTicketCents).toBe(5000);
    expect(report.newCustomers).toBe(2);
    expect(report.topProducts[0]?.quantitySold).toBe(6);
    expect(report.topCustomers[0]?.salesCents).toBe(15000);
    expect(report.financeByCategory[0]?.amountCents).toBe(3000);
    expect(queries.length).toBe(6);
    for (const query of queries) {
      expect(query.params[0]).toBe(TENANT_ID);
      expect(query.params[1]).toBe(STORE_ID);
    }
  });

  test("não apresenta custo ou margem sem base histórica confiável", async () => {
    const source = await Bun.file("apps/web/src/features/store-admin/merchant-operations-report.tsx").text();
    expect(source).toContain("Margem não é exibida sem custo histórico confiável por venda");
    expect(source).not.toContain("custo médio");
  });
});
