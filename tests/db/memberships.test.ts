// REAL DATABASE: memberships lidas do PostgreSQL + TenantContext multi-tenant.
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createDbMembershipReader } from "../../apps/web/src/lib/server/db-memberships.server.ts";
import { resolveTenantContext } from "../../packages/tenant/src/index.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedSql, seedIds, U, T } from "./seed.ts";
import type { TenantId, UserId } from "../../packages/tenant/src/index.ts";
import { asTenantId } from "../../packages/tenant/src/index.ts";

let h: Harness;
const ids = seedIds();

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  // User X: admin no Tenant A, support no Tenant B (identidade global, vínculos plurais).
  // O owner único de Tenant A já pertence a U.tenantA pela fixture canônica.
  await h.db.execScript(`
insert into public.tenant_members (tenant_id, user_id, role) values
  ('${T.a}', '${U.tenantB}', 'tenant_admin')
on conflict (tenant_id, user_id) do nothing;`);
});

afterAll(async () => {
  await h.db.close();
});

describe("memberships reais (PostgreSQL)", () => {
  test("platform_owner lido do banco", async () => {
    const reader = createDbMembershipReader(h.db);
    expect(await reader.getPlatformRoles(U.platformOwner)).toEqual(["platform_owner"]);
    expect(await reader.getPlatformRoles(U.tenantA)).toEqual([]);
  });
  test("User X: admin em A, support em B (sem tenant global único)", async () => {
    const reader = createDbMembershipReader(h.db);
    const m = await reader.getTenantMemberships(U.tenantB);
    const byTenant = new Map(m.map((x) => [x.tenantId, x.tenantRoles]));
    expect(byTenant.get(asTenantId(T.a))).toEqual(["tenant_admin"]);
    expect(byTenant.get(asTenantId(T.b))).toEqual(["tenant_support"]);
    const ctxA = resolveTenantContext({
      userId: U.tenantB as UserId,
      platformRoles: [],
      memberships: m,
      activeTenantId: T.a as TenantId,
      requestId: "r",
    });
    expect(ctxA.tenantRoles).toEqual(["tenant_admin"]);
  });
  test("store membership pertence ao tenant da store (composta)", async () => {
    const reader = createDbMembershipReader(h.db);
    const m = await reader.getTenantMemberships(U.storeA);
    const row = m.find((x) => x.storeId === ids.storeA);
    expect(row?.tenantId).toBe(asTenantId(ids.tenantA));
    expect(row?.storeRoles).toEqual(["store_admin"]);
  });
});
