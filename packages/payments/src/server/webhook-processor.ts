import type { PaymentProvider, PaymentStatus, ProviderPaymentId } from "../types.ts";
import { applyPlatformBillingEffect } from "./platform-billing-effect.ts";
import { applyTenantBillingEffect } from "./tenant-billing-effect.ts";
import {
  applyPaymentStatus,
  applyPaymentStatusResult,
  claimWebhook,
  findPaymentTarget,
  markWebhookDone,
  markWebhookFailure,
} from "./webhook-store.ts";
import type { PaymentSql } from "./webhook-store.ts";

export interface WebhookProcessorDeps {
  loadProvider(provider: "mercadopago" | "asaas", gatewayAccountId: string): Promise<PaymentProvider>;
  maxAttempts?: number;
}

export interface WebhookProcessResult {
  outcome: "processed" | "ignored" | "retry" | "dead_letter" | "busy";
  changed?: boolean;
}

async function applyFinancialEffects(sql: PaymentSql,paymentId: string,status: PaymentStatus): Promise<void> {
  await applyPlatformBillingEffect(sql,paymentId,status);
  await applyTenantBillingEffect(sql,paymentId,status);
}

async function refundStockConflict(
  sql: PaymentSql,
  provider: PaymentProvider,
  paymentId: string,
  gatewayAccountId: string,
  providerPaymentId: ProviderPaymentId,
): Promise<void> {
  await provider.refund({providerPaymentId,idempotencyKey:`stock-conflict:${paymentId}`});
  await applyPaymentStatus(sql,paymentId,gatewayAccountId,"refunded",null,true);
  await applyFinancialEffects(sql,paymentId,"refunded");
  await sql.query(
    `insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
     select null,p.tenant_id,p.store_id,'order.payment_stock_conflict_refunded','payment',p.id::text,
       jsonb_build_object('provider_payment_id',p.provider_payment_id,'automatic',true)
     from public.payments p where p.id=$1::uuid and p.gateway_account_id=$2::uuid`,
    [paymentId,gatewayAccountId],
  );
}

export async function processWebhookEvent(sql: PaymentSql,eventId: string,deps: WebhookProcessorDeps): Promise<WebhookProcessResult> {
  const maxAttempts=deps.maxAttempts??5;
  const event=await claimWebhook(sql,eventId,maxAttempts);
  if(!event) return {outcome:"busy"};
  try {
    const provider=await deps.loadProvider(event.provider,event.gatewayAccountId);
    const normalized=await provider.normalizeWebhook(event.payload);
    if(!normalized.externalEventId||normalized.externalEventId!==event.externalEventId||!normalized.providerPaymentId){
      await markWebhookDone(sql,event.id,"ignored",null,null); return {outcome:"ignored"};
    }
    const status=await provider.fetchStatus(normalized.providerPaymentId);
    const target=await findPaymentTarget(sql,event.gatewayAccountId,normalized.providerPaymentId);
    if(!target){await markWebhookDone(sql,event.id,"ignored",null,status);return {outcome:"ignored"};}
    const result=await applyPaymentStatusResult(sql,target.id,event.gatewayAccountId,status,normalized.occurredAt,target.orderId!==null);
    await applyFinancialEffects(sql,target.id,status);
    let finalStatus=status;
    if(result.requiresRefund){
      await refundStockConflict(sql,provider,target.id,event.gatewayAccountId,normalized.providerPaymentId);
      finalStatus="refunded";
    }
    await markWebhookDone(sql,event.id,"processed",target.id,finalStatus);
    return {outcome:"processed",changed:result.changed};
  } catch(error){
    const result=await markWebhookFailure(sql,event.id,event.attempts,maxAttempts,safeErrorCode(error));
    return {outcome:result};
  }
}

export async function reconcilePaymentStatus(
  sql: PaymentSql,paymentId: string,gatewayAccountId: string,provider: PaymentProvider,providerPaymentId: ProviderPaymentId,
): Promise<{status: PaymentStatus;changed: boolean}> {
  const target=await findPaymentTarget(sql,gatewayAccountId,providerPaymentId);
  if(!target||target.id!==paymentId) throw new Error("Pagamento não pertence ao gateway/provider payment informado.");
  const status=await provider.fetchStatus(providerPaymentId);
  const result=await applyPaymentStatusResult(sql,target.id,gatewayAccountId,status,null,target.orderId!==null);
  await applyFinancialEffects(sql,target.id,status);
  let finalStatus=status;
  if(result.requiresRefund){
    await refundStockConflict(sql,provider,target.id,gatewayAccountId,providerPaymentId);
    finalStatus="refunded";
  }
  await sql.query(
    `insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
     values (null,$1::uuid,$2::uuid,'payment.reconciled','payment',$3,jsonb_build_object('changed',$4::boolean,'status',$5::text))`,
    [target.tenantId,target.storeId,target.id,result.changed,finalStatus],
  );
  return {status:finalStatus,changed:result.changed};
}

function safeErrorCode(error: unknown): string {
  if(error instanceof Error&&error.message.startsWith("Provider HTTP ")) return error.message.slice(0,40);
  return "PAYMENT_PROCESSING_FAILED";
}
