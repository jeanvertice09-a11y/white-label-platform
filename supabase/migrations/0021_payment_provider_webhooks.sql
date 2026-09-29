-- Phase 11: durable payment webhook processing.
-- Independent from 0020 (reserved for parallel work).

alter table public.payments
  add column if not exists order_id uuid,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists provider_updated_at timestamptz;

alter table public.payments
  add constraint payments_order_scope_ck
  check (order_id is null or (level = 'store_checkout' and store_id is not null));

alter table public.payments
  add constraint payments_order_scope_fk
  foreign key (tenant_id, store_id, order_id)
  references public.orders(tenant_id, store_id, id)
  on delete set null (order_id);

create unique index if not exists payments_gateway_provider_payment_uidx
  on public.payments (gateway_account_id, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists payments_order_idx
  on public.payments (tenant_id, store_id, order_id)
  where order_id is not null;

alter table public.webhook_events
  add column if not exists attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text,
  add column if not exists occurred_at timestamptz,
  add column if not exists normalized_status text,
  add column if not exists payment_id uuid references public.payments(id) on delete set null;

alter table public.webhook_events
  add constraint webhook_events_attempts_ck check (attempts >= 0),
  add constraint webhook_events_status_ck
    check (status in (
      'received','processing','retry','processed','ignored','dead_letter'
    )),
  add constraint webhook_events_normalized_status_ck
    check (
      normalized_status is null
      or normalized_status in (
        'pending','authorized','captured','failed','refunded','chargeback'
      )
    );

create index if not exists webhook_events_queue_idx
  on public.webhook_events (status, next_attempt_at, created_at)
  where status in ('received','processing','retry');

create index if not exists webhook_events_payment_idx
  on public.webhook_events (payment_id)
  where payment_id is not null;
