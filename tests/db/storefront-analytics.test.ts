import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const eventId = "10000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
});

afterAll(async () => {
  await h.db.close();
});

describe("storefront analytics persistence", () => {
  test("aceita evento sem PII no mesmo tenant/store", async () => {
    await h.db.execOne(`insert into public.storefront_analytics_events(
      tenant_id,store_id,event_id,session_id,event_type
    ) values (
      '${ids.tenantA}','${ids.storeA}','${eventId}','${sessionId}','catalog_view'
    )`);
    const rows = await h.db.query(
      `select event_type from public.storefront_analytics_events where event_id=$1::uuid`,
      [eventId],
    );
    expect(rows[0]?.["event_type"]).toBe("catalog_view");
  });

  test("FK composta rejeita tenant/store cruzado", async () => {
    await expectReject(
      h.db.execOne(`insert into public.storefront_analytics_events(
        tenant_id,store_id,event_id,session_id,event_type
      ) values (
        '${ids.tenantA}','${ids.storeB}',
        '10000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000002','catalog_view'
      )`),
      "analytics cross-tenant/store",
    );
  });

  test("RLS não expõe analytics ao browser mesmo para store member", async () => {
    const rows = await h.asUser(ids.users.storeA, "authenticated", () =>
      h.db.query("select event_id from public.storefront_analytics_events"),
    );
    expect(rows).toHaveLength(0);
  });
});
