import {
  createCredentialVaultFromEnv,
  listRunnableWebhookIds,
  loadGatewayProvider,
  refreshMercadoPagoGatewayAccessToken,
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
  const sql=workerSql();
  const vault=createCredentialVaultFromEnv();
  if(provider==="mercadopago"){
    const clientId=process.env["MERCADOPAGO_CLIENT_ID"]?.trim();
    const clientSecret=process.env["MERCADOPAGO_CLIENT_SECRET"]?.trim();
    if(!clientId||!clientSecret) throw new Error("Configuração OAuth Mercado Pago ausente no worker.");
    await refreshMercadoPagoGatewayAccessToken(sql,vault,gatewayAccountId,{clientId,clientSecret});
  }
  const loaded=await loadGatewayProvider(
    sql,vault,provider,gatewayAccountId,
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
