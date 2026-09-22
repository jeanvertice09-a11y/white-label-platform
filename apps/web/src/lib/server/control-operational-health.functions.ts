import { createServerFn } from "@tanstack/react-start";
import { controlMerchantRead } from "./control-merchants.shared.server.ts";

export interface ControlOperationalHealth {
  webhookDeadLetters: number;
  webhookRetries: number;
  webhookStaleProcessing: number;
  paymentInconsistencies: number;
  suspendedDomains: number;
  stalledPendingDomains: number;
}

function count(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Indicador operacional inválido: ${key}`);
  return value;
}

async function loadControlOperationalHealth(): Promise<ControlOperationalHealth> {
  const current = await controlMerchantRead();
  const [webhookRows, paymentRows, domainRows] = await Promise.all([
    current.sql.query(
      `select
         count(*) filter (where w.status='dead_letter')::integer as dead_letters,
         count(*) filter (where w.status='retry')::integer as retries,
         count(*) filter (
           where w.status='processing' and w.processing_started_at < now()-interval '5 minutes'
         )::integer as stale_processing
       from public.webhook_events w
       join public.gateway_accounts g on g.id=w.gateway_account_id
       where g.tenant_id=$1::uuid`,
      [current.tenantId],
    ),
    current.sql.query(
      `select count(*)::integer as inconsistent
       from public.payments p
       join public.orders o
         on o.tenant_id=p.tenant_id and o.store_id=p.store_id and o.id=p.order_id
       where p.tenant_id=$1::uuid and p.order_id is not null
         and (
           (p.status='captured' and o.payment_status<>'paid')
           or (p.status in ('failed','chargeback') and o.payment_status<>'failed')
         )`,
      [current.tenantId],
    ),
    current.sql.query(
      `select
         count(*) filter (where status='suspended')::integer as suspended,
         count(*) filter (
           where status='pending' and verified_at is null and created_at < now()-interval '24 hours'
         )::integer as stalled_pending
       from public.domains where tenant_id=$1::uuid`,
      [current.tenantId],
    ),
  ]);
  const webhooks = webhookRows[0] ?? {};
  const payments = paymentRows[0] ?? {};
  const domains = domainRows[0] ?? {};
  return {
    webhookDeadLetters: count(webhooks, "dead_letters"),
    webhookRetries: count(webhooks, "retries"),
    webhookStaleProcessing: count(webhooks, "stale_processing"),
    paymentInconsistencies: count(payments, "inconsistent"),
    suspendedDomains: count(domains, "suspended"),
    stalledPendingDomains: count(domains, "stalled_pending"),
  };
}

export const getControlOperationalHealth = createServerFn({ method: "GET" }).handler(
  async () => loadControlOperationalHealth(),
);
