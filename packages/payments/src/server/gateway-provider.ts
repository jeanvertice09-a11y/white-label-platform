import type {
  PaymentLevel,
  PaymentProvider,
  PaymentProviderName,
} from "../types.ts";
import type { CredentialVault } from "./credential-vault.ts";
import { createPaymentProvider } from "./provider-factory.ts";
import type { ProviderFactoryOptions } from "./provider-factory.ts";
import type { PaymentSql } from "./webhook-store.ts";

export interface LoadedGatewayProvider {
  provider: PaymentProvider;
  level: PaymentLevel;
  tenantId: string | null;
  storeId: string | null;
}

export async function loadGatewayProvider(
  sql: PaymentSql,
  vault: CredentialVault,
  expectedProvider: PaymentProviderName,
  gatewayAccountId: string,
  options: ProviderFactoryOptions = {},
): Promise<LoadedGatewayProvider> {
  const rows = await sql.query(
    `select ga.provider,ga.level,ga.tenant_id::text,ga.store_id::text,
            s.credentials_ciphertext,s.webhook_secret_ciphertext
     from public.gateway_accounts ga
     join private.gateway_account_secrets s on s.gateway_account_id=ga.id
     where ga.id=$1::uuid and ga.provider=$2 and ga.status='active'
       and s.credentials_ciphertext is not null
     limit 1`,
    [gatewayAccountId, expectedProvider],
  );
  const row = rows.at(0);
  if (!row) throw new Error("Conta de gateway ativa não encontrada.");
  const credentialCiphertext = stringValue(row["credentials_ciphertext"]);
  const webhookCiphertext = nullableString(row["webhook_secret_ciphertext"]);
  const provider = createPaymentProvider(
    expectedProvider,
    {
      credentials: vault.decrypt(credentialCiphertext),
      webhookSecret: webhookCiphertext ? vault.decrypt(webhookCiphertext) : null,
    },
    options,
  );
  return {
    provider,
    level: String(row["level"]) as PaymentLevel,
    tenantId: nullableString(row["tenant_id"]),
    storeId: nullableString(row["store_id"]),
  };
}

function stringValue(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Segredo do gateway ausente.");
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
