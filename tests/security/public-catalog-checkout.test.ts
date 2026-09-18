import { describe, expect, test } from "bun:test";
import { isStorefrontAvailable } from "../../packages/catalog/src/index.ts";
import { DomainResolver } from "../../packages/domains/src/index.ts";
import type { DomainRecord, DomainStore } from "../../packages/domains/src/index.ts";
import type { StorefrontStore } from "../../packages/catalog/src/index.ts";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STORE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function domain(status: DomainRecord["status"], verified = true): DomainRecord {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    tenantId: TENANT,
    storeId: STORE,
    hostname: "loja.example.test",
    type: "store_catalog",
    status,
    verifiedAt: verified ? "2026-09-18T12:00:00.000Z" : null,
  };
}

function storeFor(record: DomainRecord): DomainStore {
  return {
    async findByHostname() {
      await Promise.resolve();
      return record;
    },
  };
}

function storefront(
  tenantStatus: StorefrontStore["tenantStatus"],
  storeStatus: StorefrontStore["storeStatus"],
): StorefrontStore {
  return {
    tenantId: TENANT,
    storeId: STORE,
    name: "Loja",
    slug: "loja",
    tenantStatus,
    storeStatus,
    trialEndsAt: null,
  };
}

describe("fase 10 public catalog security boundary", () => {
  test("somente domínio active e verificado resolve tenant/store", async () => {
    const active = await new DomainResolver(storeFor(domain("active"))).resolve("loja.example.test");
    expect(active?.tenantId).toBe(TENANT);
    expect(active?.storeId).toBe(STORE);
    expect(await new DomainResolver(storeFor(domain("pending"))).resolve("loja.example.test")).toBeNull();
    expect(await new DomainResolver(storeFor(domain("suspended"))).resolve("loja.example.test")).toBeNull();
    expect(await new DomainResolver(storeFor(domain("active", false))).resolve("loja.example.test")).toBeNull();
  });

  test("store ou tenant suspenso não fica operacional no storefront", () => {
    expect(isStorefrontAvailable(storefront("active", "active"))).toBe(true);
    expect(isStorefrontAvailable(storefront("active", "suspended"))).toBe(false);
    expect(isStorefrontAvailable(storefront("suspended", "active"))).toBe(false);
  });
});
