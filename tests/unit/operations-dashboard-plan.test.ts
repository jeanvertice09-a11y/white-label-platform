import { describe, expect, test } from "bun:test";
import { getCurrentStorePlan, loadMerchantDashboardActivity } from "../../apps/web/src/lib/server/operations-dashboard.functions.ts";

const TENANT_ID = "11111111-1111-4111-a111-111111111111";
const STORE_ID = "22222222-2222-4222-a222-222222222222";

describe("operations dashboard current plan", () => {
  test("reads the merchant plan from the store subscription scope", async () => {
    let queryText = "";
    let queryParams: unknown[] = [];
    const plan = await getCurrentStorePlan({
      query(sql, params) {
        queryText = sql;
        queryParams = params;
        return Promise.resolve([{ name: "Plano 1", slug: "plano-1", status: "trialing" }]);
      },
    }, TENANT_ID, STORE_ID);

    expect(plan).toEqual({ name: "Plano 1", slug: "plano-1", status: "trialing" });
    expect(queryText).toContain("public.store_subscriptions");
    expect(queryText).toContain("public.tenant_plans");
    expect(queryText).toContain("s.store_id=$2");
    expect(queryText).not.toContain("from public.subscriptions");
    expect(queryParams).toEqual([TENANT_ID, STORE_ID]);
  });

  test("returns null when the store has no subscription", async () => {
    const plan = await getCurrentStorePlan({
      query() { return Promise.resolve([]); },
    }, TENANT_ID, STORE_ID);

    expect(plan).toBeNull();
  });
});

describe("operations dashboard activity", () => {
  test("loads only recent operational data scoped by tenant and store", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const responses = [
      [{ id: "order-a", order_number: 42, customer_name: "Cliente", status: "pending", total_cents: 1990, created_at: "2026-09-22T12:00:00Z" }],
      [{ id: "task-a", title: "Separar pedido", priority: "high", due_at: "2026-09-23T12:00:00Z" }],
      [{ product_id: "product-a", variant_id: null, product_name: "Produto", variant_name: null, quantity: 2 }],
    ];
    const activity = await loadMerchantDashboardActivity({
      query(sql, params = []) {
        calls.push({ sql, params });
        return Promise.resolve(responses[calls.length - 1] ?? []);
      },
    }, { tenantId: TENANT_ID, storeId: STORE_ID });

    expect(activity.recentOrders[0]?.orderNumber).toBe(42);
    expect(activity.taskAlerts[0]?.priority).toBe("high");
    expect(activity.stockAlerts[0]?.quantity).toBe(2);
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.sql).toContain("tenant_id=$1");
      expect(call.sql).toContain("store_id=$2");
      expect(call.params).toEqual([TENANT_ID, STORE_ID]);
    }
  });
});
