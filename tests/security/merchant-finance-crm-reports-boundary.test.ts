import { describe, expect, test } from "bun:test";

async function source(path: string): Promise<string> { return Bun.file(path).text(); }

describe("merchant finance crm reports security boundary", () => {
  test("relatórios derivam tenant/store do contexto server-side", async () => {
    const reporting = await source("apps/web/src/lib/server/merchant-reporting.functions.ts");
    expect(reporting).toContain("createMerchantOperationsContext(getRequestHost())");
    expect(reporting).toContain("current.scope");
    expect(reporting).toContain("tenant_id=$1");
    expect(reporting).toContain("store_id=$2");
    expect(reporting).not.toContain("tenantId: z.string()");
    expect(reporting).not.toContain("storeId: z.string()");
  });

  test("insights de cliente validam entitlement e escopo no servidor", async () => {
    const insights = await source("apps/web/src/lib/server/customer-insights.functions.ts");
    expect(insights).toContain("createMerchantOperationsContext(getRequestHost())");
    expect(insights).toContain("assertCustomersEntitlement(current.sql, current.scope)");
    expect(insights).toContain("c.tenant_id=$1 and c.store_id=$2 and c.id=$3::uuid");
    expect(insights).toContain("o.tenant_id=$1 and o.store_id=$2 and o.customer_id=$3::uuid");
  });

  test("browser não envia totais, custo ou margem como autoridade", async () => {
    const reportUi = await source("apps/web/src/features/store-admin/merchant-operations-report.tsx");
    const customerUi = await source("apps/web/src/features/store-admin/customer-insights-panel.tsx");
    expect(reportUi).not.toContain("tenantId");
    expect(reportUi).not.toContain("storeId");
    expect(customerUi).not.toContain("tenantId");
    expect(customerUi).not.toContain("storeId");
    expect(reportUi).toContain("Margem não é exibida sem custo histórico confiável por venda");
  });
});
