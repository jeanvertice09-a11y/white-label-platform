import {
  createCredentialVaultFromEnv,
  listRunnableWebhookIds,
  loadGatewayProvider,
  processWebhookEvent,
} from "@white-label/payments/server";
import type { PaymentProviderName } from "@white-label/payments";
import { workerSql } from "./database.ts";

function asaasBaseUrl(): string {
  return process.env["ASAAS_ENV"] === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

async function loadProvider(provider: PaymentProviderName,gatewayAccountId: string) {
  const loaded=await loadGatewayProvider(
    workerSql(),createCredentialVaultFromEnv(),provider,gatewayAccountId,
    {writesEnabled:false,asaasBaseUrl:asaasBaseUrl()},
  );
  return loaded.provider;
}

export async function processPaymentWebhook(eventId:string):Promise<void>{
  await processWebhookEvent(workerSql(),eventId,{loadProvider});
}
export async function pollPaymentWebhooks():Promise<number>{
  const concurrency=Math.max(1,Number(process.env["WORKER_CONCURRENCY"]??5));
  const ids=await listRunnableWebhookIds(workerSql(),concurrency);
  await Promise.all(ids.map((id)=>processPaymentWebhook(id)));
  return ids.length;
}
