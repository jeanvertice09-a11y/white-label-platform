import { describe, expect, test } from "bun:test";
import { loadMerchantOperationsReport } from "../../apps/web/src/lib/server/operations-dashboard.functions.ts";

const TENANT_ID = "11111111-1111-4111-a111-111111111111";
const STORE_ID = "22222222-2222-4222-a222-222222222222";

describe("merchant operations report", () => {
  test("consolida dados reais do período e reaproveita o resumo financeiro existente", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const report = await loadMerchantOperationsReport({
      query(sql, params = []) {
        queries.push({ sql, params });
        if (sql.includes("from public.merchant_financial_entries")) {
          return Promise.resolve([{ open_receivable: 9000, overdue_receivable: 1000, open_payable: 4000, overdue_payable: 500, received: 12000, paid: 7000, competence_receivable: 15000, competence_payable: 8000 }]);
        }
        return Promise.resolve([{ completed_orders: 8, sales_cents: 24000, buyers: 5, customers: 12, active_products: 20, low_stock_products: 3, received_purchases: 4, received_purchases_total_cents: 9000, suppliers: 6, active_suppliers: 5, open_tasks: 7, completed_tasks: 2 }]);
      },
    }, { tenantId: TENANT_ID, storeId: STORE_ID }, "2026-09-01", "2026-09-30");
    expect(report.completedOrders).toBe(8);
    expect(report.salesCents).toBe(24000);
    expect(report.finance.cashFlowCents).toBe(5000);
    expect(report.finance.managerialResultCents).toBe(7000);
    expect(report.receivedPurchases).toBe(4);
    expect(report.receivedPurchasesTotalCents).toBe(9000);
    expect(queries.length).toBe(2);
    for (const query of queries) {
      expect(query.sql).toContain("tenant_id=$1");
      expect(query.sql).toContain("store_id=$2");
      expect(query.params[0]).toBe(TENANT_ID);
      expect(query.params[1]).toBe(STORE_ID);
    }
  });

  test("exclui pedidos inválidos e usa somente compras recebidas no SQL", async () => {
    let reportSql = "";
    await loadMerchantOperationsReport({
      query(sql) {
        if (sql.includes("from public.merchant_financial_entries")) return Promise.resolve([{ open_receivable: 0, overdue_receivable: 0, open_payable: 0, overdue_payable: 0, received: 0, paid: 0, competence_receivable: 0, competence_payable: 0 }]);
        reportSql = sql;
        return Promise.resolve([{ completed_orders: 0, sales_cents: 0, buyers: 0, customers: 0, active_products: 0, low_stock_products: 0, received_purchases: 0, received_purchases_total_cents: 0, suppliers: 0, active_suppliers: 0, open_tasks: 0, completed_tasks: 0 }]);
      },
    }, { tenantId: TENANT_ID, storeId: STORE_ID }, "2026-09-01", "2026-09-30");
    expect(reportSql).toContain("o.status='completed'");
    expect(reportSql).toContain("o.payment_status not in ('failed','refunded','cancelled')");
    expect(reportSql).toContain("p.status='received'");
    expect(reportSql).toContain("p.received_at::date between $3::date and $4::date");
  });
});
