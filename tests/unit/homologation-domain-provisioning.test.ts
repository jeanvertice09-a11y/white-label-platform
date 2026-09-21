import { describe, expect, test } from "bun:test";
import type { ManagedDomainProvisioner } from "@white-label/domains";
import {
  expectedHomologationDomains,
  runHomologationDomainProvisioningPreflight,
} from "../../scripts/homologation/domain-provisioning.ts";
import type { SqlExecutor } from "../../scripts/homologation/model.ts";
import { homologationTestConfig } from "../db/homologation-fixture.ts";

describe("homologation Vercel-domain preflight", () => {
  test("preflight faz somente SELECT/GET e nunca provisiona", async () => {
    const config = homologationTestConfig();
    const expected = expectedHomologationDomains(config);
    const byHostname = new Map(expected.map((item) => [item.hostname, item]));
    const sqlCalls: string[] = [];
    const sql: SqlExecutor = {
      query(statement, params = []) {
        sqlCalls.push(statement);
        const hostname = String(params[0]);
        const item = byHostname.get(hostname);
        if (!item) return Promise.resolve([]);
        return Promise.resolve([{
          tenant_id: item.tenantId,
          store_id: item.storeId,
          type: item.type,
          status: "active",
          verified_at: "2026-09-19T12:00:00.000Z",
        }]);
      },
    };

    let reads = 0;
    let writes = 0;
    const provisioner: ManagedDomainProvisioner = {
      getProjectDomainState(hostname) {
        reads += 1;
        return Promise.resolve({ hostname, provisioned: hostname.includes("lume"), verified: true, projectId: "prj_test" });
      },
      ensureProjectDomain(hostname) {
        writes += 1;
        return Promise.resolve({
          hostname,
          provisioned: true,
          verified: true,
          projectId: "prj_test",
          action: "created",
        });
      },
    };

    const result = await runHomologationDomainProvisioningPreflight(sql, config, provisioner);
    expect(result).toHaveLength(12);
    expect(reads).toBe(12);
    expect(writes).toBe(0);
    expect(sqlCalls).toHaveLength(12);
    expect(sqlCalls.every((statement) => statement.trimStart().startsWith("select"))).toBe(true);
  });
});
