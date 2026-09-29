import type { DomainProvider, DomainStatus, DomainType } from "@white-label/domains";
import type { ControlSql } from "./control-merchants.shared.server.ts";
import type { ControlDomainItem, ControlDomainWorkspace } from "./control-domains.types.ts";

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}
function nullable(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function mapDomain(row: Record<string, unknown>, provider: DomainProvider): ControlDomainItem {
  const hostname = text(row, "hostname");
  const token = nullable(row, "verification_token");
  const status = text(row, "status") as DomainStatus;
  const dns = status === "active" || !token
    ? null
    : provider.getDnsInstructions({ hostname, verificationToken: token });
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    storeId: nullable(row, "store_id"),
    storeName: nullable(row, "store_name"),
    hostname,
    type: text(row, "type") as DomainType,
    status,
    verifiedAt: nullable(row, "verified_at"),
    createdAt: text(row, "created_at"),
    dns,
  };
}

export async function loadControlDomainWorkspace(
  sql: ControlSql,
  tenantId: string,
  provider: DomainProvider,
  canManage: boolean,
): Promise<ControlDomainWorkspace> {
  if (!canManage) {
    return {
      canManage: false,
      providerName: provider.name,
      providerConfigured: provider.configured,
      configurationMessage: "Gestão de domínios requer tenant_owner/admin.",
      domains: [],
      stores: [],
    };
  }
  const [domainRows, storeRows] = await Promise.all([
    sql.query(
      `select d.id::text,d.tenant_id::text,d.store_id::text,s.name store_name,d.hostname,d.type,d.status,
              d.verification_token,d.verified_at::text,d.created_at::text
       from public.domains d
       left join public.stores s on s.tenant_id=d.tenant_id and s.id=d.store_id
       where d.tenant_id=$1::uuid order by d.created_at desc,d.hostname`,
      [tenantId],
    ),
    sql.query(
      `select id::text,name,status from public.stores
       where tenant_id=$1::uuid order by name,id`,
      [tenantId],
    ),
  ]);
  return {
    canManage: true,
    providerName: provider.name,
    providerConfigured: provider.configured,
    configurationMessage: provider.configured
      ? "Verificação DNS disponível."
      : "Configuração de domínio da plataforma não disponível.",
    domains: domainRows.map((row) => mapDomain(row, provider)),
    stores: storeRows.map((row) => ({ id: text(row, "id"), name: text(row, "name"), status: text(row, "status") })),
  };
}
