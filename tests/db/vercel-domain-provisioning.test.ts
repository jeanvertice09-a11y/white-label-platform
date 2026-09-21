import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  DomainResolver,
  PostgresDomainStore,
  type ManagedDomainProvisioner,
} from "@white-label/domains";
import {
  createControlDomain,
  updateControlDomain,
} from "../../apps/web/src/lib/server/control-domains.write.server.ts";
import type { Harness } from "./harness.ts";
import { setupDatabase } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();

function fakeProvisioner(calls: string[]): ManagedDomainProvisioner {
  return {
    async getProjectDomainState(hostname) {
      return Promise.resolve({ hostname, provisioned: true, verified: true, projectId: "prj_test" });
    },
    async ensureProjectDomain(hostname) {
      calls.push(hostname);
      return Promise.resolve({
        hostname,
        provisioned: true,
        verified: true,
        projectId: "prj_test",
        action: "already_provisioned",
      });
    },
  };
}

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
});

afterAll(async () => {
  await h.db.close();
});

describe("managed Kataluu domain provisioning boundary", () => {
  test("Vercel provisionada continua pending e sem verified_at no Kataluu", async () => {
    const calls: string[] = [];
    const created = await createControlDomain(
      h.db,
      ids.tenantA,
      ids.users.tenantA,
      { hostname: "hml-boundary.kataluu.com.br", type: "store_catalog", storeId: ids.storeA },
      fakeProvisioner(calls),
    );
    expect(calls).toEqual(["hml-boundary.kataluu.com.br"]);

    const rows = await h.db.query(
      "select status,verified_at from public.domains where id=$1::uuid",
      [created.id],
    );
    expect(rows[0]?.["status"]).toBe("pending");
    expect(rows[0]?.["verified_at"]).toBeNull();

    const resolver = new DomainResolver(new PostgresDomainStore(h.db));
    expect(await resolver.resolve("hml-boundary.kataluu.com.br")).toBeNull();
  });

  test("IDOR de update não chama Vercel antes de provar ownership", async () => {
    const foreign = await createControlDomain(
      h.db,
      ids.tenantB,
      ids.users.tenantB,
      { hostname: "foreign-before.example.test", type: "tenant_panel", storeId: null },
    );
    const calls: string[] = [];
    await expect(
      updateControlDomain(
        h.db,
        ids.tenantA,
        ids.users.tenantA,
        {
          domainId: foreign.id,
          hostname: "idor-managed.kataluu.com.br",
          type: "tenant_panel",
          storeId: null,
        },
        fakeProvisioner(calls),
      ),
    ).rejects.toThrow("Domínio não encontrado");
    expect(calls).toHaveLength(0);
  });
});
