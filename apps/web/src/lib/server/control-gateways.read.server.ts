import type { ControlSql } from "./control-merchants.shared.server.ts";
import type {
  GatewayScope,
  SafeGatewayAccount,
} from "./control-gateways.types.ts";
import { assertGatewayScope, controlTenantBillingScope } from "./control-gateways.scope.server.ts";

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullable(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

export async function listSafeGatewayAccounts(
  sql: ControlSql,
  scope: GatewayScope,
): Promise<SafeGatewayAccount[]> {
  assertGatewayScope(scope);
  const rows = await sql.query(
    `select ga.id::text,ga.level,ga.tenant_id::text,ga.store_id::text,ga.provider,
       ga.label,ga.public_identifier,ga.status,ga.created_at::text,ga.updated_at::text,
       exists(
         select 1 from private.gateway_account_secrets s
         where s.gateway_account_id=ga.id and s.credentials_ciphertext is not null
       ) configured,
       exists(
         select 1 from private.gateway_account_secrets s
         where s.gateway_account_id=ga.id and s.webhook_secret_ciphertext is not null
       ) webhook_configured
     from public.gateway_accounts ga
     where ga.level=$1
       and ga.tenant_id is not distinct from $2::uuid
       and ga.store_id is not distinct from $3::uuid
     order by ga.created_at desc,ga.id`,
    [scope.level, scope.tenantId, scope.storeId],
  );
  return rows.map((row) => ({
    id: text(row, "id"),
    level: text(row, "level") as SafeGatewayAccount["level"],
    tenantId: nullable(row, "tenant_id"),
    storeId: nullable(row, "store_id"),
    provider: text(row, "provider") as SafeGatewayAccount["provider"],
    label: text(row, "label"),
    publicIdentifier: nullable(row, "public_identifier"),
    status: text(row, "status") as SafeGatewayAccount["status"],
    configured: row["configured"] === true,
    webhookConfigured: row["webhook_configured"] === true,
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  }));
}

export async function loadControlGatewayWorkspace(
  sql: ControlSql,
  tenantId: string,
  canManage: boolean,
) {
  if (!canManage) {
    return { level: "tenant_billing" as const, canManage: false, accounts: [] };
  }
  const accounts = await listSafeGatewayAccounts(sql, controlTenantBillingScope(tenantId));
  return { level: "tenant_billing" as const, canManage: true, accounts };
}
