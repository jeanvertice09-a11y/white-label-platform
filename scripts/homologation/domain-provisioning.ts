import type { DomainType, ManagedDomainProvisioner } from "@white-label/domains";
import { DEMO_STORES, DEMO_TENANTS } from "./fixtures/data.ts";
import type { HomologationRuntimeConfig, SqlExecutor } from "./model.ts";
import { requireStoreDomain } from "./model.ts";

interface ExpectedDomain {
  hostname: string;
  tenantId: string;
  storeId: string | null;
  type: DomainType;
}

export interface HomologationDomainPreview {
  hostname: string;
  type: DomainType;
  database: "absent" | "match" | "mismatch";
  databaseStatus: string | null;
  databaseVerifiedAt: string | null;
  vercel: "already_provisioned" | "needs_provisioning" | "error";
  vercelVerified: boolean | null;
  error: string | null;
}

export function expectedHomologationDomains(config: HomologationRuntimeConfig): ExpectedDomain[] {
  const rows: ExpectedDomain[] = [];
  for (const tenant of DEMO_TENANTS) {
    const domain = config.domains[tenant.key];
    rows.push({ hostname: domain.tenantSite, tenantId: tenant.id, storeId: null, type: "tenant_site" });
    rows.push({ hostname: domain.tenantPanel, tenantId: tenant.id, storeId: null, type: "tenant_panel" });
    for (const store of DEMO_STORES.filter((item) => item.tenantKey === tenant.key)) {
      const storeDomain = requireStoreDomain(config, tenant.key, store.key);
      rows.push({
        hostname: storeDomain.admin,
        tenantId: tenant.id,
        storeId: store.id,
        type: "store_admin",
      });
      rows.push({
        hostname: storeDomain.catalog,
        tenantId: tenant.id,
        storeId: store.id,
        type: "store_catalog",
      });
    }
  }
  return rows;
}

async function databasePreview(sql: SqlExecutor, expected: ExpectedDomain) {
  const rows = await sql.query(
    `select tenant_id::text,store_id::text,type,status,verified_at::text
     from public.domains where hostname=$1 limit 1`,
    [expected.hostname],
  );
  const row = rows.at(0);
  if (!row) return { state: "absent" as const, status: null, verifiedAt: null };
  const tenantId = typeof row["tenant_id"] === "string" ? row["tenant_id"] : null;
  const storeId = typeof row["store_id"] === "string" ? row["store_id"] : null;
  const type = typeof row["type"] === "string" ? row["type"] : null;
  const matches = tenantId === expected.tenantId && storeId === expected.storeId && type === expected.type;
  return {
    state: matches ? "match" as const : "mismatch" as const,
    status: typeof row["status"] === "string" ? row["status"] : null,
    verifiedAt: typeof row["verified_at"] === "string" ? row["verified_at"] : null,
  };
}

export async function runHomologationDomainProvisioningPreflight(
  sql: SqlExecutor,
  config: HomologationRuntimeConfig,
  provisioner: ManagedDomainProvisioner,
): Promise<HomologationDomainPreview[]> {
  const result: HomologationDomainPreview[] = [];
  for (const expected of expectedHomologationDomains(config)) {
    const database = await databasePreview(sql, expected);
    try {
      const vercel = await provisioner.getProjectDomainState(expected.hostname);
      result.push({
        hostname: expected.hostname,
        type: expected.type,
        database: database.state,
        databaseStatus: database.status,
        databaseVerifiedAt: database.verifiedAt,
        vercel: vercel.provisioned ? "already_provisioned" : "needs_provisioning",
        vercelVerified: vercel.verified,
        error: null,
      });
    } catch (error) {
      result.push({
        hostname: expected.hostname,
        type: expected.type,
        database: database.state,
        databaseStatus: database.status,
        databaseVerifiedAt: database.verifiedAt,
        vercel: "error",
        vercelVerified: null,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
  return result;
}

async function assertDatabaseDomainsReady(sql: SqlExecutor, expected: ExpectedDomain[]): Promise<void> {
  for (const domain of expected) {
    const database = await databasePreview(sql, domain);
    if (database.state !== "match") {
      throw new Error(`Domínio HML não está persistido no escopo esperado: ${domain.hostname}`);
    }
  }
}

export async function provisionHomologationDomains(
  sql: SqlExecutor,
  config: HomologationRuntimeConfig,
  provisioner: ManagedDomainProvisioner,
) {
  const expected = expectedHomologationDomains(config);
  await assertDatabaseDomainsReady(sql, expected);
  const results = [];
  for (const domain of expected) {
    results.push(await provisioner.ensureProjectDomain(domain.hostname));
  }
  return results;
}
