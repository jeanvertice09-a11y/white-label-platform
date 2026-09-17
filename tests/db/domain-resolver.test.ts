// REAL DATABASE: DomainResolver lendo PostgreSQL (PostgresDomainStore).
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { DomainResolver, PostgresDomainStore } from "../../packages/domains/src/index.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedSql, seedIds } from "./seed.ts";

let h: Harness;
const ids = seedIds();

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
insert into public.domains (tenant_id, store_id, hostname, type, status, verification_token, verified_at) values
  ('${ids.tenantA}', null, 'tenant-a.localhost', 'tenant_site', 'active', 'tok', now()),
  ('${ids.tenantA}', '${ids.storeA}', 'loja-a.localhost', 'store_catalog', 'active', 'tok', now()),
  ('${ids.tenantB}', null, 'tenant-b.localhost', 'tenant_site', 'active', 'tok', now()),
  ('${ids.tenantA}', null, 'pending.localhost', 'tenant_site', 'pending', 'tok', null)
on conflict (id) do nothing;`);
});

afterAll(async () => {
  await h.db.close();
});

describe("domain resolver real (PostgreSQL)", () => {
  test("tenant-a.localhost resolve Tenant A; loja-a.localhost resolve Store A", async () => {
    const r = new DomainResolver(new PostgresDomainStore(h.db));
    const a = await r.resolve("tenant-a.localhost");
    expect(a?.tenantId).toBe(ids.tenantA);
    expect(a?.storeId).toBeNull();
    const s = await r.resolve("Loja-A.localhost:5173");
    expect(s?.tenantId).toBe(ids.tenantA);
    expect(s?.storeId).toBe(ids.storeA);
  });
  test("tenant-b resolve B; pendente e desconhecido retornam null", async () => {
    const r = new DomainResolver(new PostgresDomainStore(h.db));
    expect((await r.resolve("tenant-b.localhost"))?.tenantId).toBe(ids.tenantB);
    expect(await r.resolve("pending.localhost")).toBeNull();
    expect(await r.resolve("nao-existe.localhost")).toBeNull();
  });
});
