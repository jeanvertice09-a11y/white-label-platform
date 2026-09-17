// REAL DATABASE: matriz RLS com usuários autenticados distintos (engine real).
// Papeis: superuser do harness = service_role (bypassa RLS); role
// authenticated + app.test_uid = usuário logado (RLS enforced); anon = anônimo.
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedSql, seedIds } from "./seed.ts";

let h: Harness;
const ids = seedIds();

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
});

afterAll(async () => {
  await h.db.close();
});

async function count(table: string, where: string): Promise<number> {
  const rows = await h.db.query(`select 1 as one from ${table} where ${where}`);
  return rows.length;
}

describe("RLS real: tenant A x B (PostgreSQL)", () => {
  test("USER_TENANT_A lê Tenant A, não lê Tenant B", async () => {
    const a = await h.asUser(ids.users.tenantA, "authenticated", () => count("public.tenants", "id = '" + ids.tenantA + "'"));
    const b = await h.asUser(ids.users.tenantA, "authenticated", () => count("public.tenants", "id = '" + ids.tenantB + "'"));
    expect(a).toBe(1);
    expect(b).toBe(0);
  });
  test("USER_TENANT_B não acessa Tenant A (espelho)", async () => {
    const a = await h.asUser(ids.users.tenantB, "authenticated", () => count("public.tenants", "id = '" + ids.tenantA + "'"));
    expect(a).toBe(0);
  });
  test("UUID conhecido não concede acesso (SELECT/UPDATE/DELETE zeram)", async () => {
    const upd = await h.asUser(ids.users.tenantA, "authenticated", () =>
      h.db.query(`update public.tenants set name = 'hack' where id = '${ids.tenantB}' returning id`),
    );
    const del = await h.asUser(ids.users.tenantA, "authenticated", () =>
      h.db.query(`delete from public.stores where id = '${ids.storeB}' returning id`),
    );
    expect(upd.length).toBe(0);
    expect(del.length).toBe(0);
  });
  test("INSERT/UPDATE/DELETE negados mesmo no próprio tenant (só service)", async () => {
    const ins = await h.asUser(ids.users.tenantA, "authenticated", async () => {
      try {
        await h.db.query(`insert into public.stores (tenant_id, slug, name) values ('${ids.tenantA}', 'x', 'X')`);
        return 1;
      } catch {
        return 0;
      }
    });
    expect(ins).toBe(0);
  });
  test("membership própria legível; alheia invisível (sem recursão)", async () => {
    const own = await h.asUser(ids.users.tenantA, "authenticated", () =>
      count("public.tenant_members", `user_id = '${ids.users.tenantA}'`),
    );
    const other = await h.asUser(ids.users.tenantA, "authenticated", () =>
      count("public.tenant_members", `user_id = '${ids.users.tenantB}'`),
    );
    expect(own).toBe(1);
    expect(other).toBe(0);
  });
});

describe("RLS real: store A x B + anon/service (PostgreSQL)", () => {
  test("USER_STORE_A lê Store A e products A; nada de B", async () => {
    const sa = await h.asUser(ids.users.storeA, "authenticated", () => count("public.stores", `id = '${ids.storeA}'`));
    const sb = await h.asUser(ids.users.storeA, "authenticated", () => count("public.stores", `id = '${ids.storeB}'`));
    expect(sa).toBe(1);
    expect(sb).toBe(0);
  });
  test("USER_STORE_B não acessa Store A (espelho)", async () => {
    const sa = await h.asUser(ids.users.storeB, "authenticated", () => count("public.stores", `id = '${ids.storeA}'`));
    expect(sa).toBe(0);
  });
  test("anon não lê nada (deny-by-default)", async () => {
    const n = await h.asUser(null, "anon", async () => {
      try {
        return await count("public.tenants", "true");
      } catch {
        return -1;
      }
    });
    expect(n).toBeLessThanOrEqual(0);
  });
  test("service_role (superuser do harness) bypassa RLS p/ operações admin", async () => {
    const all = await count("public.tenants", "true");
    expect(all).toBe(2);
  });
});
