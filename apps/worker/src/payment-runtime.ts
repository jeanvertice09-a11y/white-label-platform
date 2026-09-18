import postgres from "postgres";
import {
  createCredentialVaultFromEnv,
  listRunnableWebhookIds,
  loadGatewayProvider,
  processWebhookEvent,
} from "@white-label/payments/server";
import type { PaymentProviderName } from "@white-label/payments";

type SqlFn = ReturnType<typeof postgres>;

let client: SqlFn | null = null;

function sqlExecutor() {
  return {
    async query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
      const rows = await db().unsafe(sql, params as never[]);
      return rows as Record<string, unknown>[];
    },
  };
}

function db(): SqlFn {
  if (client) return client;
  const url = process.env["SUPABASE_DB_URL"];
  if (!url) throw new Error("SUPABASE_DB_URL ausente no worker.");
  client = postgres(url, {
    max: Number(process.env["WORKER_CONCURRENCY"] ?? 5),
    prepare: false,
    ssl: "require",
  });
  return client;
}

function asaasBaseUrl(): string {
  return process.env["ASAAS_ENV"] === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

async function loadProvider(
  provider: PaymentProviderName,
  gatewayAccountId: string,
) {
  const loaded = await loadGatewayProvider(
    sqlExecutor(),
    createCredentialVaultFromEnv(),
    provider,
    gatewayAccountId,
    {
      writesEnabled: false,
      asaasBaseUrl: asaasBaseUrl(),
    },
  );
  return loaded.provider;
}

export async function processPaymentWebhook(eventId: string): Promise<void> {
  await processWebhookEvent(sqlExecutor(), eventId, { loadProvider });
}

export async function pollPaymentWebhooks(): Promise<number> {
  const concurrency = Math.max(1, Number(process.env["WORKER_CONCURRENCY"] ?? 5));
  const ids = await listRunnableWebhookIds(sqlExecutor(), concurrency);
  await Promise.all(ids.map((id) => processPaymentWebhook(id)));
  return ids.length;
}

export async function closePaymentRuntime(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}
