import { createServerFn } from "@tanstack/react-start";
import { controlMerchantRead } from "./control-merchants.shared.server.ts";

export interface OperationalDeadLetterJob {
  id: string;
  kind: string;
  lastError: string | null;
  createdAt: string;
}

export interface ControlOperationalHealth {
  webhookDeadLetters: number;
  webhookRetries: number;
  webhookStaleProcessing: number;
  paymentInconsistencies: number;
  suspendedDomains: number;
  stalledPendingDomains: number;
  jobRetries: number;
  jobDeadLetters: number;
  jobStaleRunning: number;
  deadLetterJobs: OperationalDeadLetterJob[];
}

type Rows = Record<string, unknown>[];

function count(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Indicador operacional inválido: ${key}`);
  return value;
}

async function loadRows(sql: { query(sql: string, params: unknown[]): Promise<Rows> }, tenantId: string) {
  return Promise.all([
    sql.query(`select count(*) filter (where w.status='dead_letter')::integer dead_letters,
      count(*) filter (where w.status='retry')::integer retries,
      count(*) filter (where w.status='processing' and w.processing_started_at < now()-interval '5 minutes')::integer stale_processing
      from public.webhook_events w join public.gateway_accounts g on g.id=w.gateway_account_id where g.tenant_id=$1::uuid`, [tenantId]),
    sql.query(`select count(*)::integer inconsistent from public.payments p join public.orders o
      on o.tenant_id=p.tenant_id and o.store_id=p.store_id and o.id=p.order_id
      where p.tenant_id=$1::uuid and p.order_id is not null and
      ((p.status='captured' and o.payment_status<>'paid') or (p.status in ('failed','chargeback') and o.payment_status<>'failed'))`, [tenantId]),
    sql.query(`select count(*) filter (where status='suspended')::integer suspended,
      count(*) filter (where status='pending' and verified_at is null and created_at < now()-interval '24 hours')::integer stalled_pending
      from public.domains where tenant_id=$1::uuid`, [tenantId]),
    sql.query(`select count(*) filter (where status='retry')::integer retries,
      count(*) filter (where status='dead_letter')::integer dead_letters,
      count(*) filter (where status='running' and lease_expires_at < now())::integer stale_running
      from public.operational_jobs where tenant_id=$1::uuid`, [tenantId]),
    sql.query(`select id::text,kind,last_error,created_at::text from public.operational_jobs
      where tenant_id=$1::uuid and status='dead_letter' order by updated_at desc limit 10`, [tenantId]),
  ]);
}

function mapDeadLetters(rows: Rows): OperationalDeadLetterJob[] {
  return rows.map((row) => ({
    id: String(row["id"]),
    kind: String(row["kind"]),
    lastError: typeof row["last_error"] === "string" ? row["last_error"] : null,
    createdAt: String(row["created_at"]),
  }));
}

async function loadControlOperationalHealth(): Promise<ControlOperationalHealth> {
  const current = await controlMerchantRead();
  const [webhookRows, paymentRows, domainRows, jobRows, deadLetterRows] = await loadRows(current.sql, current.tenantId);
  const webhooks = webhookRows[0] ?? {}, payments = paymentRows[0] ?? {};
  const domains = domainRows[0] ?? {}, jobs = jobRows[0] ?? {};
  return {
    webhookDeadLetters: count(webhooks, "dead_letters"),
    webhookRetries: count(webhooks, "retries"),
    webhookStaleProcessing: count(webhooks, "stale_processing"),
    paymentInconsistencies: count(payments, "inconsistent"),
    suspendedDomains: count(domains, "suspended"),
    stalledPendingDomains: count(domains, "stalled_pending"),
    jobRetries: count(jobs, "retries"),
    jobDeadLetters: count(jobs, "dead_letters"),
    jobStaleRunning: count(jobs, "stale_running"),
    deadLetterJobs: mapDeadLetters(deadLetterRows),
  };
}

export const getControlOperationalHealth = createServerFn({ method: "GET" }).handler(
  async () => loadControlOperationalHealth(),
);
