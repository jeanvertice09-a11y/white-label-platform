import type { BillingSqlExecutor } from "./postgres-entitlements.ts";

export interface PlatformBillableEventInput {
  tenantId: string;
  eventType: string;
  quantity: number;
  periodStart: string;
  periodEnd: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

function assertEventInput(input: PlatformBillableEventInput): void {
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(input.eventType)) throw new Error("Tipo de evento inválido");
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new Error("Quantidade inválida");
  if (!input.idempotencyKey || input.idempotencyKey.length > 160) throw new Error("Idempotência inválida");
  if (Date.parse(input.periodEnd) <= Date.parse(input.periodStart)) throw new Error("Período inválido");
}

export async function recordPlatformBillableEvent(
  sql: BillingSqlExecutor,
  input: PlatformBillableEventInput,
): Promise<string> {
  assertEventInput(input);
  const rows = await sql.query(
    `with selected_rate as (
       select unit_cents,currency
       from public.platform_billing_rates
       where metric_key=$2 and active=true
         and effective_from <= $4::timestamptz
         and (effective_to is null or effective_to > $3::timestamptz)
       order by effective_from desc
       limit 1
     ), inserted as (
       insert into public.billing_events (
         level,tenant_id,store_id,event_type,quantity,unit_cents,total_cents,currency,
         period_start,period_end,status,idempotency_key,metadata
       )
       select 'platform_billing',$1,null,$2,$5,r.unit_cents,$5*r.unit_cents,r.currency,
         $3,$4,'pending',$6,$7::jsonb
       from selected_rate r
       on conflict do nothing
       returning id
     ), existing as (
       select id from public.billing_events
       where level='platform_billing' and tenant_id=$1 and store_id is null and idempotency_key=$6
     )
     select id from inserted union all select id from existing limit 1`,
    [
      input.tenantId,
      input.eventType,
      input.periodStart,
      input.periodEnd,
      input.quantity,
      input.idempotencyKey,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const id = rows[0]?.["id"];
  if (typeof id !== "string") throw new Error("Tarifa de billing não configurada para o evento/período");
  return id;
}
