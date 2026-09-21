import { describe, expect, test } from "bun:test";
import { loadStoreCommercialPlanSummary } from "../../apps/web/src/lib/server/operations-dashboard-plan.server.ts";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const STORE_ID = "22222222-2222-4222-8222-222222222222";

describe("operations dashboard commercial plan", () => {
  test("resolves the store plan from the authoritative tenant billing relation", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const plan = await loadStoreCommercialPlanSummary(
      {
        query(sql, params) {
          calls.push({ sql, params });
          return Promise.resolve([{ name: "Plano 1 HML", slug: "plano-1-hml", status: "active" }]);
        },
      },
      { tenantId: TENANT_ID, storeId: STORE_ID },
    );

    expect(plan).toEqual({ name: "Plano 1 HML", slug: "plano-1-hml", status: "active" });
    expect(calls).toHaveLength(1);
    const call = calls[0];
    const normalized = call.sql.replace(/\s+/g, " ");
    expect(normalized).toContain("from public.store_subscriptions s");
    expect(normalized).toContain("join public.tenant_plans p");
    expect(normalized).toContain("p.tenant_id=s.tenant_id");
    expect(normalized).toContain("s.store_id=$2::uuid");
    expect(call.params).toEqual([TENANT_ID, STORE_ID]);
  });

  test("does not invent a plan when the store has no subscription", async () => {
    const plan = await loadStoreCommercialPlanSummary(
      { query() { return Promise.resolve([]); } },
      { tenantId: TENANT_ID, storeId: STORE_ID },
    );

    expect(plan).toBeNull();
  });
});
