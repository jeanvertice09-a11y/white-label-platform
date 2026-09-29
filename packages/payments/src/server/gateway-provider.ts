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


export async function refreshMercadoPagoGatewayAccessToken(
  sql: PaymentSql,
  vault: CredentialVault,
  gatewayAccountId: string,
  oauth: { clientId: string; clientSecret: string; fetch?: typeof fetch },
): Promise<void> {
  const rows = await sql.query(
    `select s.oauth_refresh_token_ciphertext,s.oauth_access_token_expires_at
     from public.gateway_accounts ga
     join private.gateway_account_secrets s on s.gateway_account_id=ga.id
     where ga.id=$1::uuid and ga.provider='mercadopago'
       and ga.level='store_checkout' and ga.status='active'
     limit 1`,
    [gatewayAccountId],
  );
  const row = rows.at(0);
  if (!row) throw new Error("Conta Mercado Pago ativa não encontrada.");
  const expiresAt = row["oauth_access_token_expires_at"];
  if (expiresAt instanceof Date && expiresAt.getTime() > Date.now() + 300_000) return;
  if (typeof expiresAt === "string" && Date.parse(expiresAt) > Date.now() + 300_000) return;
  const refreshCiphertext = row["oauth_refresh_token_ciphertext"];
  if (typeof refreshCiphertext !== "string" || !refreshCiphertext) {
    throw new Error("Refresh token Mercado Pago ausente.");
  }
  const http = oauth.fetch ?? fetch;
  const response = await http("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      grant_type: "refresh_token",
      refresh_token: vault.decrypt(refreshCiphertext),
    }),
  });
  const body = await response.json() as Record<string, unknown>;
  const accessToken = body["access_token"];
  const refreshToken = body["refresh_token"];
  const expiresIn = body["expires_in"];
  if (!response.ok || typeof accessToken !== "string" || typeof refreshToken !== "string" || typeof expiresIn !== "number") {
    throw new Error("Falha ao renovar autorização Mercado Pago.");
  }
  await sql.query(
    `update private.gateway_account_secrets
     set credentials_ciphertext=$2,oauth_refresh_token_ciphertext=$3,
         oauth_access_token_expires_at=now()+($4::int*interval '1 second'),updated_at=now()
     where gateway_account_id=$1::uuid`,
    [gatewayAccountId, vault.encrypt(accessToken), vault.encrypt(refreshToken), Math.max(60, Math.trunc(expiresIn))],
  );
}
