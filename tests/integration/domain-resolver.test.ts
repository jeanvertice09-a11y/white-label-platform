import { describe, expect, test } from "bun:test";
import {
  DomainResolver,
  InMemoryDomainCache,
  invalidateDomainCache,
  type CachedDomainResolution,
  type DomainCache,
  type DomainRecord,
} from "../../packages/domains/src/index.ts";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";

function record(hostname: string, tenantId = T1, storeId: string | null = null): DomainRecord {
  return { id: hostname, tenantId, storeId, hostname, type: storeId ? "store_catalog" : "tenant_site", status: "active", verifiedAt: "2026-01-01" };
}

describe("domain resolver cache", () => {
  test("miss consulta fonte autoritativa, normaliza hostname e hit evita nova consulta", async () => {
    let calls = 0;
    const store = { findByHostname(h: string) { calls++; return Promise.resolve(h === "a.example.com" ? record(h) : null); } };
    const resolver = new DomainResolver(store, new InMemoryDomainCache());
    expect((await resolver.resolve(" HTTPS://A.Example.Com:443/path "))?.tenantId).toBe(T1);
    expect((await resolver.resolve("a.example.com"))?.tenantId).toBe(T1);
    expect(calls).toBe(1);
  });

  test("TTL expirado volta à fonte autoritativa", async () => {
    let now = 1_000;
    let calls = 0;
    const cache = new InMemoryDomainCache(() => now);
    const store = { findByHostname(h: string) { calls++; return Promise.resolve(record(h)); } };
    const resolver = new DomainResolver(store, cache, 5);
    await resolver.resolve("a.example.com");
    now += 5_001;
    await resolver.resolve("a.example.com");
    expect(calls).toBe(2);
  });

  test("erro em cache.get faz fallback para PostgreSQL e erro em cache.set não derruba resolução", async () => {
    let calls = 0;
    const cache: DomainCache = {
      get: () => Promise.reject(new Error("cache down")),
      set: () => Promise.reject(new Error("cache down")),
      del: () => Promise.resolve(),
    };
    const store = { findByHostname(h: string) { calls++; return Promise.resolve(record(h)); } };
    expect((await new DomainResolver(store, cache).resolve("a.example.com"))?.tenantId).toBe(T1);
    expect(calls).toBe(1);
  });

  test("entrada de outro hostname é ignorada e não vaza tenant/store", async () => {
    const wrong: CachedDomainResolution = { hostname: "b.example.com", tenantId: T2, storeId: "store-b", type: "store_catalog" };
    const cache: DomainCache = { get: () => Promise.resolve(wrong), set: () => Promise.resolve(), del: () => Promise.resolve() };
    const store = { findByHostname(h: string) { return Promise.resolve(record(h, T1, "store-a")); } };
    const resolved = await new DomainResolver(store, cache).resolve("a.example.com");
    expect(resolved).toEqual({ tenantId: T1, storeId: "store-a", type: "store_catalog" });
  });

  test("domínio inexistente retorna null e falha autoritativa propaga fail-closed", async () => {
    const missing = { findByHostname: () => Promise.resolve(null) };
    expect(await new DomainResolver(missing, new InMemoryDomainCache()).resolve("missing.example.com")).toBeNull();
    const failed = { findByHostname: () => Promise.reject(new Error("postgres unavailable")) };
    const resolution = new DomainResolver(failed, new InMemoryDomainCache()).resolve("a.example.com");
    try {
      await resolution;
      throw new Error("expected authoritative resolution to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("postgres unavailable");
    }
  });

  test("invalidação remove resolução anterior", async () => {
    let tenant = T1;
    let calls = 0;
    const cache = new InMemoryDomainCache();
    const store = { findByHostname(h: string) { calls++; return Promise.resolve(record(h, tenant)); } };
    const resolver = new DomainResolver(store, cache);
    expect((await resolver.resolve("a.example.com"))?.tenantId).toBe(T1);
    tenant = T2;
    expect((await resolver.resolve("a.example.com"))?.tenantId).toBe(T1);
    await invalidateDomainCache(cache, "A.EXAMPLE.COM");
    expect((await resolver.resolve("a.example.com"))?.tenantId).toBe(T2);
    expect(calls).toBe(2);
  });
});
