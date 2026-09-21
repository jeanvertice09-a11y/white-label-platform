import { describe, expect, test } from "bun:test";
import { getCurrentStorePlan } from "../../apps/web/src/lib/server/operations-dashboard.functions.ts";

const TENANT_ID = "11111111-1111-4111-a111-111111111111";
const STORE_ID = "22222222-2222-4222-a222-222222222222";

describe("operations dashboard current plan", () => {
  test("reads the merchant plan from the store subscription scope", async () => {
    let queryText = "";
    let queryParams: unknown[] = [];
    const plan = await getCurrentStorePlan({
      async query(sql, params) {
        queryText = sql;
        queryParams = params;
        return [{ name: "Plano 1", slug: "plano-1", status: "trialing" }];
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
      async query() { return []; },
    }, TENANT_ID, STORE_ID);

    expect(plan).toBeNull();
  });
});
