-- 0023_marketing_campaigns.sql
-- Fundação de campanhas CRM. Nenhum provider externo é acionado nesta fase.

create table public.marketing_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  customer_id uuid not null,
  status text not null check (status in ('opted_in','opted_out')),
  source text not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id, customer_id)
    references public.customers (tenant_id, store_id, id)
    on delete cascade,
  unique (tenant_id, store_id, customer_id),
  constraint marketing_consents_source_ck
    check (length(btrim(source)) between 1 and 80),
  constraint marketing_consents_timestamps_ck check (
    (status='opted_in' and granted_at is not null and revoked_at is null)
    or (status='opted_out' and revoked_at is not null)
  )
);

create index marketing_consents_scope_status_idx
  on public.marketing_consents (tenant_id, store_id, status, customer_id);

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  name text not null,
  content text not null,
  status text not null default 'draft'
    check (status in ('draft','prepared','scheduled','cancelled')),
  segment_type text not null default 'all'
    check (segment_type in ('all','with_orders','without_orders')),
  scheduled_at timestamptz,
  prepared_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id)
    on delete cascade,
  unique (tenant_id, store_id, id),
  constraint marketing_campaigns_name_ck
    check (length(btrim(name)) between 1 and 160),
  constraint marketing_campaigns_content_ck
    check (length(content) between 1 and 5000),
  constraint marketing_campaigns_state_ck check (
    (status='draft' and prepared_at is null and cancelled_at is null)
    or (status in ('prepared','scheduled') and prepared_at is not null and cancelled_at is null)
    or (status='cancelled' and cancelled_at is not null)
  )
);

create index marketing_campaigns_scope_list_idx
  on public.marketing_campaigns (tenant_id, store_id, created_at desc, id desc);
create index marketing_campaigns_schedule_idx
  on public.marketing_campaigns (scheduled_at, tenant_id, store_id)
  where status='scheduled';

create table public.marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  campaign_id uuid not null,
  customer_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued','blocked_consent','cancelled')),
  consent_snapshot_status text not null
    check (consent_snapshot_status='opted_in'),
  available_at timestamptz not null,
  prepared_at timestamptz not null default now(),
  blocked_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id, campaign_id)
    references public.marketing_campaigns (tenant_id, store_id, id)
    on delete cascade,
  foreign key (tenant_id, store_id, customer_id)
    references public.customers (tenant_id, store_id, id)
    on delete cascade,
  unique (tenant_id, store_id, campaign_id, customer_id),
  unique (tenant_id, store_id, id),
  constraint marketing_campaign_recipients_state_ck check (
    (status='queued' and blocked_at is null)
    or (status='blocked_consent' and blocked_at is not null)
    or status='cancelled'
  )
);

create index marketing_campaign_recipients_queue_idx
  on public.marketing_campaign_recipients
    (tenant_id, store_id, status, available_at, campaign_id);
create index marketing_campaign_recipients_customer_idx
  on public.marketing_campaign_recipients
    (tenant_id, store_id, customer_id, campaign_id);

alter table public.marketing_consents enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_recipients enable row level security;
