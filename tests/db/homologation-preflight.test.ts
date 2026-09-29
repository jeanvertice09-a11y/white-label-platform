import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DEMO_TENANTS } from "../../scripts/homologation/fixtures/data.ts";
import { stableUuid } from "../../scripts/homologation/model.ts";
import { runHomologationPreflight } from "../../scripts/homologation/preflight.ts";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { homologationTestConfig, prepareHomologationHarness } from "./homologation-fixture.ts";

let h: Harness;
const config = homologationTestConfig();

async function scopeCounts(): Promise<Record<string, number>> {
  const tables = ["tenants", "stores", "domains", "gateway_accounts", "payments", "tenant_plans"] as const;
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
  test("valida quatro templates reais sem limits técnicos artificiais e não escreve", async () => {
    const before = await scopeCounts();
    const result = await runHomologationPreflight(h.db, config);
    expect(result.entitlementCounts).toEqual({ lume: 23, botanica: 23, passo: 23, casa: 22 });
    expect(new Set(Object.values(result.templateIds)).size).toBe(4);
    expect(await scopeCounts()).toEqual(before);
  });

  test("bloqueia ID determinístico de tenant pertencente a outro registro", async () => {
    const tenant = DEMO_TENANTS.at(0);
    if (!tenant) throw new Error("tenant de homologação ausente");
    await h.db.query(
      "insert into public.tenants(id,slug,name,status) values ($1::uuid,'real-id-collision','Real Collision','active')",
      [tenant.id],
    );
    await expectReject(runHomologationPreflight(h.db, config), "preflight deve rejeitar colisão de ID determinístico");
    await h.db.query("delete from public.tenants where id=$1::uuid", [tenant.id]);
  });

  test("bloqueia Auth UUID duplicado", async () => {
    const duplicate = structuredClone(config);
    duplicate.storeOwners.lume = duplicate.tenantOwners.aurora;
    await expectReject(runHomologationPreflight(h.db, duplicate), "preflight deve rejeitar UUID Auth duplicado");
  });

  test("bloqueia Auth ausente em vez de seguir com warning", async () => {
    const ownerId = config.tenantOwners.aurora;
    const email = config.tenantOwnerEmails.aurora;
    await h.db.query("delete from auth.users where id=$1::uuid", [ownerId]);
    await expectReject(runHomologationPreflight(h.db, config), "preflight deve rejeitar Auth ausente");
    await h.db.query("insert into auth.users(id,email) values ($1::uuid,$2)", [ownerId, email]);
  });

  test("bloqueia email Auth divergente", async () => {
    const ownerId = config.storeOwners.lume;
    const email = config.storeOwnerEmails.lume;
    await h.db.query("update auth.users set email='wrong@example.test' where id=$1::uuid", [ownerId]);
    await expectReject(runHomologationPreflight(h.db, config), "preflight deve rejeitar email divergente");
    await h.db.query("update auth.users set email=$2 where id=$1::uuid", [ownerId, email]);
  });

  test("bloqueia membership dos usuários HML fora do escopo esperado", async () => {
    const foreignTenant = stableUuid("test:foreign-membership");
    await h.db.query(
      "insert into public.tenants(id,slug,name,status) values ($1::uuid,'foreign-membership','Foreign Membership','active')",
      [foreignTenant],
    );
    await h.db.query(
      "insert into public.tenant_members(tenant_id,user_id,role) values ($1::uuid,$2::uuid,'tenant_owner')",
      [foreignTenant, config.storeOwners.lume],
    );
    await expectReject(runHomologationPreflight(h.db, config), "preflight deve rejeitar membership fora do escopo");
    await h.db.query("delete from public.tenants where id=$1::uuid", [foreignTenant]);
  });

  test("bloqueia colisão de qualquer hostname configurado", async () => {
    const foreignTenant = stableUuid("test:foreign-domain");
    await h.db.query(
      "insert into public.tenants(id,slug,name,status) values ($1::uuid,'foreign-domain','Foreign Domain','active')",
      [foreignTenant],
    );
    await h.db.query(
      `insert into public.domains(id,tenant_id,hostname,type,status)
       values ($1::uuid,$2::uuid,$3,'tenant_site','pending')`,
      [stableUuid("test:foreign-domain-row"), foreignTenant, config.domains.aurora.tenantSite],
    );
    await expectReject(runHomologationPreflight(h.db, config), "preflight deve rejeitar hostname ocupado");
    await h.db.query("delete from public.tenants where id=$1::uuid", [foreignTenant]);
  });
});
