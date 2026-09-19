import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DEMO_TENANTS } from "../../scripts/homologation/fixtures/data.ts";
import { runHomologationPreflight } from "../../scripts/homologation/preflight.ts";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { homologationTestConfig, prepareHomologationHarness } from "./homologation-fixture.ts";

let h: Harness;
const config = homologationTestConfig();

async function scopeCounts(): Promise<Record<string, number>> {
  const tables = ["tenants", "stores", "domains", "gateway_accounts", "payments"] as const;
  const entries = await Promise.all(tables.map(async (table) => {
    const rows = await h.db.query(`select count(*)::int total from public.${table}`);
    return [table, Number(rows[0]?.["total"] ?? 0)] as const;
  }));
  return Object.fromEntries(entries);
}

beforeAll(async () => {
  h = await setupDatabase();
  await prepareHomologationHarness(h, config);
});

afterAll(async () => { await h.db.close(); });

describe("homologation production preflight", () => {
  test("usa a matriz comercial oficial sem limits técnicos artificiais e não escreve", async () => {
    const before = await scopeCounts();
    const result = await runHomologationPreflight(h.db, config);
    expect(result.entitlementCount).toBe(23);
    expect(await scopeCounts()).toEqual(before);
  });

  test("bloqueia ID determinístico de tenant pertencente a outro registro", async () => {
    const tenant = DEMO_TENANTS[0];
    if (!tenant) throw new Error("tenant de homologação ausente");
    await h.db.query(
      "insert into public.tenants(id,slug,name,status) values ($1::uuid,'real-id-collision','Real Collision','active')",
      [tenant.id],
    );
    await expectReject(
      runHomologationPreflight(h.db, config),
      "preflight deve rejeitar colisão de ID determinístico",
    );
    await h.db.query("delete from public.tenants where id=$1::uuid", [tenant.id]);
  });

  test("bloqueia Auth ausente em vez de seguir com warning", async () => {
    const ownerId = config.tenantOwners.aurora;
    const rows = await h.db.query("select email from auth.users where id=$1::uuid", [ownerId]);
    const email = rows[0]?.["email"];
    if (typeof email !== "string") throw new Error("email de teste ausente");
    await h.db.query("delete from auth.users where id=$1::uuid", [ownerId]);
    await expectReject(
      runHomologationPreflight(h.db, config),
      "preflight deve rejeitar Auth ausente",
    );
    await h.db.query("insert into auth.users(id,email) values ($1::uuid,$2)", [ownerId, email]);
  });
});