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

const APPLY_STATUS_SQL = `with payment_candidate as (
  select p.id,p.tenant_id,p.store_id,p.order_id,p.status
  from public.payments p
  where p.id=$1::uuid and p.gateway_account_id=$2::uuid
  for update
), changed as (
  update public.payments
  set status=$3,
      provider_updated_at=coalesce($4::timestamptz,provider_updated_at,now()),
      updated_at=now()
  from payment_candidate pc
  where public.payments.id=pc.id and public.payments.gateway_account_id=$2::uuid
    and status is distinct from $3
    and (
      (status='pending' and $3 in ('authorized','captured','failed','refunded','chargeback'))
      or (status='authorized' and $3 in ('captured','failed','refunded','chargeback'))
      or (status='captured' and $3 in ('refunded','chargeback'))
    )
    and (
      $4::timestamptz is null
      or provider_updated_at is null
      or $4::timestamptz >= provider_updated_at
    )
  returning id,tenant_id,store_id,order_id,status
), order_locked as materialized (
  select o.id,o.tenant_id,o.store_id,o.status,o.payment_status
  from public.orders o join changed c
    on c.order_id=o.id and c.tenant_id=o.tenant_id and c.store_id=o.store_id
  where c.order_id is not null
  for update of o
), order_change as (
  update public.orders o
  set payment_status=case
      when c.status='captured' then 'paid'
      when c.status in ('failed','chargeback') then 'failed'
      when c.status='refunded' then 'refunded'
      else o.payment_status end,
    status=case
      when c.status='captured' and ol.status='pending' then 'confirmed'
      when c.status in ('failed','chargeback','refunded') and ol.status in ('pending','confirmed','preparing','ready') then 'cancelled'
      else o.status end,
    confirmed_at=case when c.status='captured' and ol.status='pending' then coalesce(o.confirmed_at,now()) else o.confirmed_at end,
    cancelled_at=case when c.status in ('failed','chargeback','refunded') and ol.status in ('pending','confirmed','preparing','ready') then coalesce(o.cancelled_at,now()) else o.cancelled_at end,
    updated_at=now()
  from changed c join order_locked ol on ol.id=c.order_id
  where o.id=ol.id and o.tenant_id=ol.tenant_id and o.store_id=ol.store_id
  returning o.id,o.tenant_id,o.store_id,ol.status previous_status,o.status,c.status payment_status
), stock_needs as (
  select oi.tenant_id,oi.store_id,oi.product_id,oi.variant_id,sum(oi.qty)::integer qty
  from public.order_items oi join order_change oc on oc.id=oi.order_id
  join public.products p on p.tenant_id=oi.tenant_id and p.store_id=oi.store_id and p.id=oi.product_id and p.track_inventory=true
  where oc.payment_status='captured' and oc.previous_status='pending' and oi.product_id is not null
  group by oi.tenant_id,oi.store_id,oi.product_id,oi.variant_id
), stock_variant_targets as materialized (
  select n.*,v.stock_quantity::integer current_quantity from stock_needs n
  join public.product_variants v on n.variant_id is not null and v.tenant_id=n.tenant_id and v.store_id=n.store_id and v.product_id=n.product_id and v.id=n.variant_id
  order by v.id for update of v
), stock_simple_targets as materialized (
  select n.*,p.stock_quantity::integer current_quantity from stock_needs n
  join public.products p on n.variant_id is null and p.tenant_id=n.tenant_id and p.store_id=n.store_id and p.id=n.product_id
  order by p.id for update of p
), stock_targets as (select * from stock_variant_targets union all select * from stock_simple_targets),
stock_guard as (
  select case when exists(select 1 from stock_needs) and (
    (select count(*) from stock_targets)<>(select count(*) from stock_needs)
    or exists(select 1 from stock_targets where current_quantity<qty)
  ) then 1/0 else 1 end ok
), stock_sales as (
  insert into public.stock_movements(tenant_id,store_id,product_id,variant_id,delta,reason,movement_type,reference_type,reference_id)
  select t.tenant_id,t.store_id,t.product_id,t.variant_id,-t.qty,'Pagamento aprovado','sale','order',oc.id
  from stock_targets t join order_change oc on oc.tenant_id=t.tenant_id and oc.store_id=t.store_id cross join stock_guard
  on conflict do nothing returning tenant_id,store_id,product_id,variant_id,delta
), variant_delta as (
  select tenant_id,store_id,product_id,variant_id,sum(delta)::integer delta from stock_sales where variant_id is not null group by 1,2,3,4
), variant_update as (
  update public.product_variants v set stock_quantity=v.stock_quantity+d.delta,updated_at=now() from variant_delta d
  where v.tenant_id=d.tenant_id and v.store_id=d.store_id and v.product_id=d.product_id and v.id=d.variant_id returning v.id
), product_delta as (
  select tenant_id,store_id,product_id,sum(delta)::integer delta from stock_sales where variant_id is null group by 1,2,3
), product_update as (
  update public.products p set stock_quantity=p.stock_quantity+d.delta,updated_at=now() from product_delta d
  where p.tenant_id=d.tenant_id and p.store_id=d.store_id and p.id=d.product_id returning p.id
), restore_source as (
  select sm.tenant_id,sm.store_id,sm.product_id,sm.variant_id,sum(-sm.delta)::integer qty,oc.id order_id
  from public.stock_movements sm join order_change oc on oc.id=sm.reference_id
  where oc.payment_status in ('failed','chargeback','refunded') and oc.previous_status<>'pending'
    and sm.movement_type='sale' and sm.reference_type='order' and sm.delta<0
  group by sm.tenant_id,sm.store_id,sm.product_id,sm.variant_id,oc.id
), stock_returns as (
  insert into public.stock_movements(tenant_id,store_id,product_id,variant_id,delta,reason,movement_type,reference_type,reference_id)
  select tenant_id,store_id,product_id,variant_id,qty,'Pagamento cancelado/reembolsado','cancellation','order',order_id from restore_source
  on conflict do nothing returning tenant_id,store_id,product_id,variant_id,delta
), return_variant_delta as (
  select tenant_id,store_id,product_id,variant_id,sum(delta)::integer delta from stock_returns where variant_id is not null group by 1,2,3,4
), return_variant_update as (
  update public.product_variants v set stock_quantity=v.stock_quantity+d.delta,updated_at=now() from return_variant_delta d
  where v.tenant_id=d.tenant_id and v.store_id=d.store_id and v.product_id=d.product_id and v.id=d.variant_id returning v.id
), return_product_delta as (
  select tenant_id,store_id,product_id,sum(delta)::integer delta from stock_returns where variant_id is null group by 1,2,3
), return_product_update as (
  update public.products p set stock_quantity=p.stock_quantity+d.delta,updated_at=now() from return_product_delta d
  where p.tenant_id=d.tenant_id and p.store_id=d.store_id and p.id=d.product_id returning p.id
), order_audit as (
  insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
  select null,tenant_id,store_id,'order.payment_transition','order',id::text,
    jsonb_build_object('from',previous_status,'to',case when payment_status='captured' then 'confirmed' else 'cancelled' end,'payment_status',payment_status)
  from order_change where status is distinct from previous_status returning id
), audit as (
  insert into public.audit_logs(
    actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
  )
  select null,tenant_id,store_id,'payment.status_changed','payment',id::text,
    jsonb_build_object('status',status,'source','provider_reconciliation')
  from changed returning id
)
select exists(select 1 from changed) changed`;
