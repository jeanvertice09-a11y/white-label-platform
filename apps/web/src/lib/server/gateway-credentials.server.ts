import type { CredentialVault } from "@white-label/payments/server";
import type { PaymentProviderName } from "@white-label/payments";
import type { ControlSql } from "./control-merchants.shared.server.ts";
import type { GatewayScope } from "./control-gateways.types.ts";
import { assertGatewayScope } from "./control-gateways.scope.server.ts";

export interface GatewayCredentialMaterial {
  provider: PaymentProviderName;
  publicIdentifier: string | null;
  credentials: string;
  webhookSecret: string | null;
}

export async function loadGatewayCredentialMaterial(
  sql: ControlSql,
  vault: CredentialVault,
  scope: GatewayScope,
  gatewayAccountId: string,
): Promise<GatewayCredentialMaterial> {
  assertGatewayScope(scope);
  const rows = await sql.query(
    `select ga.provider,ga.public_identifier,s.credentials_ciphertext,
       s.webhook_secret_ciphertext
     from public.gateway_accounts ga
     join private.gateway_account_secrets s on s.gateway_account_id=ga.id
     where ga.id=$4::uuid and ga.level=$1
       and ga.tenant_id is not distinct from $2::uuid
       and ga.store_id is not distinct from $3::uuid
       and ga.status='active'
       and s.credentials_ciphertext is not null`,
    [scope.level, scope.tenantId, scope.storeId, gatewayAccountId],
  );
  const row = rows[0];
  if (!row) throw new Error("Gateway ativo/configurado não encontrado neste escopo.");
  const ciphertext = row["credentials_ciphertext"];
  const webhookCiphertext = row["webhook_secret_ciphertext"];
  if (typeof ciphertext !== "string") {
    throw new Error("Gateway ativo/configurado não encontrado neste escopo.");
  }
  return {
    provider: String(row["provider"]) as PaymentProviderName,
    publicIdentifier: typeof row["public_identifier"] === "string" ? row["public_identifier"] : null,
    credentials: vault.decrypt(ciphertext),
    webhookSecret: typeof webhookCiphertext === "string" ? vault.decrypt(webhookCiphertext) : null,
  };
}
