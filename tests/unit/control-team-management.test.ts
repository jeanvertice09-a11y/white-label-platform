import { describe, expect, test } from "bun:test";
import type { ControlTeamSql } from "../../apps/web/src/lib/server/control-team.shared.server.ts";
import {
  removeStoreMember,
  removeTenantMember,
  upsertStoreMember,
  upsertTenantMember,
} from "../../apps/web/src/lib/server/control-team.write.server.ts";

const TENANT = "11111111-1111-4111-8111-111111111111";
const STORE = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const ACTOR = "44444444-4444-4444-8444-444444444444";

function fake(rows: Record<string, unknown>[]): { sql: ControlTeamSql; calls: Array<{ query: string; params: unknown[] }> } {
  const calls: Array<{ query: string; params: unknown[] }> = [];
  return {
    calls,
    sql: {
      async query(query, params) {
        calls.push({ query, params });
        return Promise.resolve(rows);
      },
    },
  };
}

describe("control team membership mutations", () => {
  test("tenant scope e actor são fixados server-side na mutation", async () => {
    const f = fake([{ user_id: USER, role: "tenant_admin" }]);
    await upsertTenantMember(f.sql, TENANT, ACTOR, true, "admin@example.com", "tenant_admin");
    expect(f.calls[0]?.params).toEqual([TENANT, "admin@example.com", "tenant_admin", true, ACTOR]);
    expect(f.calls[0]?.query).toContain("where tm.tenant_id=$1::uuid");
  });

  test("remoção de tenant member usa tenant + user id e guarda owner", async () => {
    const f = fake([{ user_id: USER }]);
    await removeTenantMember(f.sql, TENANT, ACTOR, true, USER);
    expect(f.calls[0]?.params).toEqual([TENANT, USER, true, ACTOR]);
    expect(f.calls[0]?.query).toContain("where tenant_id=$1::uuid and user_id=$2::uuid");
    expect(f.calls[0]?.query).toContain("count(*) from public.tenant_members");
  });

  test("store member usa tenant + store e não aceita store_owner", async () => {
    const f = fake([{ user_id: USER, role: "store_manager" }]);
    await upsertStoreMember(f.sql, TENANT, ACTOR, STORE, "user@example.com", "store_manager");
    expect(f.calls[0]?.params).toEqual([TENANT, STORE, "user@example.com", "store_manager", ACTOR]);
    expect(f.calls[0]?.query).toContain("where tenant_id=$1::uuid and id=$2::uuid");
  });

  test("remoção cross-store fica vinculada ao par tenant/store", async () => {
    const f = fake([{ user_id: USER }]);
    await removeStoreMember(f.sql, TENANT, ACTOR, STORE, USER);
    expect(f.calls[0]?.params).toEqual([TENANT, STORE, USER, ACTOR]);
    expect(f.calls[0]?.query).toContain("tenant_id=$1::uuid and store_id=$2::uuid and user_id=$3::uuid");
  });
});
