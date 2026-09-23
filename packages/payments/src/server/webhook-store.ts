import type {
  PaymentProviderName,
  PaymentStatus,
  ProviderPaymentId,
} from "../types.ts";

export interface PaymentSql {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface PersistWebhookInput {
  provider: PaymentProviderName;
  gatewayAccountId: string;
  externalEventId: string;
  type: string;
  payload: unknown;
  occurredAt: string | null;
}

export interface ClaimedWebhook {
  id: string;
  provider: PaymentProviderName;
  gatewayAccountId: string;
  externalEventId: string;
  payload: unknown;
  attempts: number;
}

export interface PaymentTarget {
  id: string;
  tenantId: string;
  storeId: string | null;
  orderId: string | null;
  status: PaymentStatus;
}

export async function persistVerifiedWebhook(
  sql: PaymentSql,
  input: PersistWebhookInput,
): Promise<{ id: string; inserted: boolean }> {
  if (!input.externalEventId) throw new Error("Webhook sem event id.");
  const params = [
    input.provider,
    input.gatewayAccountId,
    input.externalEventId,
    input.type,
    JSON.stringify(input.payload),
    input.occurredAt,
  ];
  const inserted = await sql.query(
    `with event as (
       insert into public.webhook_events(
         provider,gateway_account_id,external_event_id,type,payload,status,occurred_at
       ) values ($1,$2::uuid,$3,$4,$5::jsonb,'received',$6::timestamptz)
       on conflict (provider,gateway_account_id,external_event_id) do nothing
       returning id,gateway_account_id
     ), audit as (
       insert into public.audit_logs(
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select null,ga.tenant_id,ga.store_id,'payment.webhook_verified',
         'webhook_event',e.id::text,jsonb_build_object('provider',ga.provider)
       from event e join public.gateway_accounts ga on ga.id=e.gateway_account_id
       returning id
     )
     select id::text from event`,
    params,
  );
  const row = inserted.at(0);
  if (row) return { id: String(row["id"]), inserted: true };
  const existing = await sql.query(
    `select id::text from public.webhook_events
     where provider=$1 and gateway_account_id=$2::uuid and external_event_id=$3`,
    params.slice(0, 3),
  );
  const id = existing.at(0)?.["id"];
  if (typeof id !== "string") throw new Error("Falha ao resolver webhook idempotente.");
  return { id, inserted: false };
}

export async function claimWebhook(
  sql: PaymentSql,
  eventId: string,
  maxAttempts: number,
): Promise<ClaimedWebhook | null> {
  const rows = await sql.query(
    `update public.webhook_events
     set status='processing',attempts=attempts+1,processing_started_at=now(),
         last_error=null
     where id=$1::uuid
       and attempts < $2::int
       and (
         status='received'
         or (status='retry' and coalesce(next_attempt_at,now()) <= now())
         or (status='processing' and processing_started_at < now()-interval '5 minutes')
       )
     returning id::text,provider,gateway_account_id::text,external_event_id,
       payload,attempts`,
    [eventId, maxAttempts],
  );
  const row = rows.at(0);
  if (!row) return null;
  return {
    id: String(row["id"]),
    provider: providerName(row["provider"]),
    gatewayAccountId: String(row["gateway_account_id"]),
    externalEventId: String(row["external_event_id"]),
    payload: row["payload"],
    attempts: Number(row["attempts"]),
  };
}

export async function findPaymentTarget(
  sql: PaymentSql,
  gatewayAccountId: string,
  providerPaymentId: ProviderPaymentId,
): Promise<PaymentTarget | null> {
  const rows = await sql.query(
    `select id::text,tenant_id::text,store_id::text,order_id::text,status
     from public.payments
     where gateway_account_id=$1::uuid and provider_payment_id=$2
     limit 1`,
    [gatewayAccountId, providerPaymentId],
  );
  const row = rows.at(0);
  if (!row) return null;
  return {
    id: String(row["id"]),
    tenantId: String(row["tenant_id"]),
    storeId: typeof row["store_id"] === "string" ? row["store_id"] : null,
    orderId: typeof row["order_id"] === "string" ? row["order_id"] : null,
    status: String(row["status"]) as PaymentStatus,
  };
}

export async function applyPaymentStatus(
  sql: PaymentSql,
  paymentId: string,
  gatewayAccountId: string,
  status: PaymentStatus,
  occurredAt: string | null,
): Promise<boolean> {
  const rows = await sql.query(APPLY_STATUS_SQL, [
    paymentId,
    gatewayAccountId,
    status,
    occurredAt,
  ]);
  return rows.at(0)?.["changed"] === true;
}

export async function markWebhookDone(
  sql: PaymentSql,
  eventId: string,
  result: "processed" | "ignored",
  paymentId: string | null,
  normalizedStatus: PaymentStatus | null,
): Promise<void> {
  await sql.query(
    `update public.webhook_events
     set status=$2,processed_at=now(),payment_id=$3::uuid,
         normalized_status=$4,next_attempt_at=null,last_error=null
     where id=$1::uuid`,
    [eventId, result, paymentId, normalizedStatus],
  );
}

export async function markWebhookFailure(
  sql: PaymentSql,
  eventId: string,
  attempts: number,
  maxAttempts: number,
  errorCode: string,
): Promise<"retry" | "dead_letter"> {
  const dead = attempts >= maxAttempts;
  const delay = Math.min(300, 2 ** Math.max(0, attempts - 1) * 5);
  await sql.query(
    `update public.webhook_events
     set status=$2,last_error=$3,
         next_attempt_at=case when $2='retry'
           then now()+($4::int * interval '1 second') else null end,
         processed_at=case when $2='dead_letter' then now() else processed_at end
     where id=$1::uuid`,
    [eventId, dead ? "dead_letter" : "retry", errorCode, delay],
  );
  return dead ? "dead_letter" : "retry";
}

export async function listRunnableWebhookIds(
  sql: PaymentSql,
  limit: number,
): Promise<string[]> {
  const rows = await sql.query(
    `select id::text from public.webhook_events
     where status='received'
       or (status='retry' and coalesce(next_attempt_at,now()) <= now())
       or (status='processing' and processing_started_at < now()-interval '5 minutes')
     order by created_at,id
     limit $1::int`,
    [limit],
  );
  return rows.map((row) => String(row["id"]));
}

function providerName(value: unknown): PaymentProviderName {
  if (value === "mercadopago" || value === "asaas") return value;
  throw new Error("Provider persistido inválido.");
}

import { APPLY_STATUS_SQL } from "./store-checkout-lifecycle.sql.ts";
