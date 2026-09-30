import type { EnqueueJob, JobKind, OperationalJob } from "./types.ts";
import type { WorkerSql } from "../database.ts";

function text(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function kind(value: unknown): JobKind {
  if (value === "email.send" || value === "media.process" || value === "billing.reconcile" || value === "domain.verify" || value === "store_payment.reconcile" || value === "shipment.recover") return value;
  throw new Error("Operational job kind inválido.");
}

function payloadVersion(value: unknown): 1 {
  if (value === 1) return 1;
  throw new Error("Operational job payload version inválida.");
}

export async function enqueueJob(sql: WorkerSql, input: EnqueueJob): Promise<string | null> {
  const rows = await sql.query(
    `insert into public.operational_jobs
      (tenant_id,store_id,kind,payload_version,payload,idempotency_key,max_attempts)
     values ($1::uuid,$2::uuid,$3,$4::smallint,$5::jsonb,$6,$7::int)
     on conflict (kind,idempotency_key) do nothing
     returning id::text`,
    [input.tenantId ?? null,input.storeId ?? null,input.kind,input.payloadVersion ?? 1,JSON.stringify(input.payload),
      input.idempotencyKey,input.maxAttempts ?? 8],
  );
  return text(rows[0] ?? {}, "id");
}


export interface OperationalQueueHealth {
  queued: number;
  retry: number;
  running: number;
  deadLetter: number;
  expiredLeases: number;
  oldestReadyAgeSeconds: number | null;
}

export async function getOperationalQueueHealth(sql: WorkerSql): Promise<OperationalQueueHealth> {
  const rows = await sql.query(
    `select
       count(*) filter (where status='queued')::integer as queued,
       count(*) filter (where status='retry')::integer as retry,
       count(*) filter (where status='running')::integer as running,
       count(*) filter (where status='dead_letter')::integer as dead_letter,
       count(*) filter (where status='running' and lease_expires_at < now())::integer as expired_leases,
       extract(epoch from (now()-min(created_at) filter (
         where status in ('queued','retry') and available_at <= now()
       )))::integer as oldest_ready_age_seconds
     from public.operational_jobs`,
    [],
  );
  const row=rows[0] ?? {};
  const age=row["oldest_ready_age_seconds"];
  return {
    queued:Number(row["queued"] ?? 0),
    retry:Number(row["retry"] ?? 0),
    running:Number(row["running"] ?? 0),
    deadLetter:Number(row["dead_letter"] ?? 0),
    expiredLeases:Number(row["expired_leases"] ?? 0),
    oldestReadyAgeSeconds:age === null || age === undefined ? null : Number(age),
  };
}

export async function purgeCompletedJobs(sql: WorkerSql): Promise<number> {
  const rows = await sql.query(
    `with doomed as (
       select id from public.operational_jobs
       where status='completed' and completed_at < now()-interval '30 days'
       order by completed_at limit 100
     ), deleted as (
       delete from public.operational_jobs j using doomed d where j.id=d.id returning j.id
     )
     select count(*)::integer as count from deleted`,
    [],
  );
  return Number(rows[0]?.["count"] ?? 0);
}

export async function reapExhaustedLeases(sql: WorkerSql): Promise<number> {
  const rows = await sql.query(
    `with exhausted as (
       update public.operational_jobs
       set status='dead_letter',lease_expires_at=null,locked_by=null,
           last_error=coalesce(last_error,'Worker lease expired on final attempt'),updated_at=now()
       where status='running' and lease_expires_at < now() and attempts >= max_attempts
       returning id,tenant_id,store_id,kind,attempts
     ), audited as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select null,tenant_id,store_id,'worker.job.dead_letter','operational_job',id::text,
         jsonb_build_object('kind',kind,'attempts',attempts,'reason','expired_final_lease')
       from exhausted returning id
     )
     select count(*)::integer as count from exhausted`,
    [],
  );
  return Number(rows[0]?.["count"] ?? 0);
}

export async function claimJobs(
  sql: WorkerSql,
  workerId: string,
  limit: number,
  leaseSeconds = 120,
): Promise<OperationalJob[]> {
  const rows = await sql.query(
    `with candidates as (
       select id from public.operational_jobs
       where attempts < max_attempts and (
         (status in ('queued','retry') and available_at <= now())
         or (status='running' and lease_expires_at < now())
       )
       order by available_at,created_at,id
       for update skip locked
       limit $2::int
     )
     update public.operational_jobs j
     set status='running',attempts=j.attempts+1,locked_by=$1,
         lease_expires_at=now()+($3::int*interval '1 second'),
         last_error=null,updated_at=now()
     from candidates c where j.id=c.id
     returning j.id::text,j.tenant_id::text,j.store_id::text,j.kind,j.payload_version,j.payload,j.attempts,j.max_attempts`,
    [workerId,limit,leaseSeconds],
  );
  return rows.map((row) => ({
    id: text(row,"id") ?? "",
    tenantId: text(row,"tenant_id"),
    storeId: text(row,"store_id"),
    kind: kind(row["kind"]),
    payloadVersion: payloadVersion(row["payload_version"]),
    payload: typeof row["payload"] === "object" && row["payload"] !== null
      ? row["payload"] as Record<string, unknown> : {},
    attempts: Number(row["attempts"]),
    maxAttempts: Number(row["max_attempts"]),
  }));
}

export async function completeJob(sql: WorkerSql, jobId: string, workerId: string): Promise<void> {
  await sql.query(
    `with finished as (
       update public.operational_jobs
       set status='completed',completed_at=now(),lease_expires_at=null,locked_by=null,
           last_error=null,updated_at=now()
       where id=$1::uuid and status='running' and locked_by=$2
       returning id,tenant_id,store_id,kind
     )
     insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
     select null,tenant_id,store_id,'worker.job.completed','operational_job',id::text,
       jsonb_build_object('kind',kind) from finished`,
    [jobId,workerId],
  );
}

export async function failJob(
  sql: WorkerSql,
  job: OperationalJob,
  workerId: string,
  error: unknown,
): Promise<"retry" | "dead_letter"> {
  const dead = job.attempts >= job.maxAttempts;
  const delay = Math.min(3600, 5 * 2 ** Math.max(0, job.attempts - 1));
  const message = error instanceof Error ? error.message.slice(0,1000) : "Operational job failed";
  await sql.query(
    `with failed as (
       update public.operational_jobs
       set status=$3,last_error=$4,available_at=case when $3='retry'
         then now()+($5::int*interval '1 second') else available_at end,
         lease_expires_at=null,locked_by=null,updated_at=now()
       where id=$1::uuid and status='running' and locked_by=$2
       returning id,tenant_id,store_id,kind,status,attempts
     )
     insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
     select null,tenant_id,store_id,'worker.job.dead_letter','operational_job',id::text,
       jsonb_build_object('kind',kind,'attempts',attempts)
     from failed where status='dead_letter'`,
    [job.id,workerId,dead ? "dead_letter" : "retry",message,delay],
  );
  return dead ? "dead_letter" : "retry";
}
