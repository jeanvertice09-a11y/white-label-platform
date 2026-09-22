-- 0034_operational_jobs.sql — durable operational queue for non-webhook background work.
create table public.operational_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  store_id uuid,
  kind text not null check (kind in ('email.send','media.process','billing.reconcile','domain.verify')),
  payload_version smallint not null default 1 check (payload_version = 1),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status text not null default 'queued'
    check (status in ('queued','running','retry','completed','dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 8 check (max_attempts between 1 and 50),
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  locked_by text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id) references public.stores(tenant_id, id) on delete cascade,
  constraint operational_jobs_scope_ck check (store_id is null or tenant_id is not null),
  constraint operational_jobs_running_ck check (
    (status='running' and lease_expires_at is not null and locked_by is not null)
    or (status<>'running' and lease_expires_at is null and locked_by is null)
  ),
  constraint operational_jobs_completed_ck check (
    (status='completed' and completed_at is not null)
    or (status<>'completed' and completed_at is null)
  ),
  unique(kind,idempotency_key)
);

create index operational_jobs_runnable_idx
  on public.operational_jobs(status,available_at,created_at)
  where status in ('queued','retry','running');
create index operational_jobs_tenant_status_idx
  on public.operational_jobs(tenant_id,status,created_at desc);
create index operational_jobs_store_status_idx
  on public.operational_jobs(tenant_id,store_id,status,created_at desc)
  where store_id is not null;

alter table public.operational_jobs enable row level security;
-- Deliberately no browser policy. Queue mutation is server/worker-only.
