import { describe, expect, test } from "bun:test";
import { DomainResolver } from "../../packages/domains/src/resolver.ts";
import type { DomainRecord } from "../../packages/domains/src/resolver.ts";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";

function store() {
  return {
    findByHostname(h: string): Promise<DomainRecord | null> {
      if (h === "a.example.com") {
        return Promise.resolve({
          id: "d1",
          tenantId: T1,
          storeId: null,
          hostname: h,
          type: "tenant_site" as const,
          status: "active" as const,
          verifiedAt: "2026-01-01",
        });
      }
      if (h === "b.example.com") {
        return Promise.resolve({
          id: "d2",
          tenantId: T2,
          storeId: null,
          hostname: h,
          type: "tenant_site" as const,
          status: "active" as const,
          verifiedAt: "2026-01-01",
        });
      }
      if (h === "pending.example.com") {
        return Promise.resolve({
          id: "d3",
          tenantId: T1,
          storeId: null,
          hostname: h,
          type: "tenant_site" as const,
          status: "pending" as const,
          verifiedAt: null,
        });
      }
      return Promise.resolve(null);
    },
  };
}

describe("domain resolver", () => {
  test("domínio A resolve somente tenant A; B somente B; pendente = null", async () => {
    const r = new DomainResolver(store());
    expect((await r.resolve("a.example.com"))?.tenantId).toBe(T1);
    expect((await r.resolve("b.example.com"))?.tenantId).toBe(T2);
    expect(await r.resolve("pending.example.com")).toBeNull();
  });
  test("hostname inválido rejeitado", async () => {
    const r = new DomainResolver(store());
    let threw = false;
    try {
      await r.resolve("!!!");
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
