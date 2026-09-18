-- Phase 13: Kataluu -> White Label billing (platform_billing only).
-- Additive hardening. Does not seed prices/plans and does not touch 0019/0021.

alter table public.plans
  add column if not exists active boolean not null default true,
  add column if not exists billing_interval text;

alter table public.plans
  add constraint plans_billing_interval_ck
  check (
    billing_interval is null
    or billing_interval in ('monthly','quarterly','yearly')
  );

alter table public.subscriptions
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_started_at timestamptz,
  add column if not exists current_period_ends_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.subscriptions
  add constraint subscriptions_status_ck
  check (status in ('trialing','active','past_due','canceled','expired')) not valid,
  add constraint subscriptions_trial_window_ck
  check (
    (trial_started_at is null and trial_ends_at is null)
    or (
      trial_started_at is not null
      and trial_ends_at is not null
      and trial_ends_at > trial_started_at
    )
  ) not valid,
  add constraint subscriptions_period_window_ck
  check (
    (current_period_started_at is null and current_period_ends_at is null)
    or (
      current_period_started_at is not null
      and current_period_ends_at is not null
      and current_period_ends_at > current_period_started_at
    )
  ) not valid,
  add constraint subscriptions_tenant_id_uidx unique (tenant_id, id);

create unique index if not exists subscriptions_platform_current_uidx
  on public.subscriptions (tenant_id)
  where level='platform_billing' and status in ('trialing','active','past_due');

alter table public.payments
  add column if not exists subscription_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists provider_create_started_at timestamptz,
  add column if not exists platform_effect_status text;

alter table public.payments
  add constraint payments_subscription_scope_fk
  foreign key (tenant_id, subscription_id)
  references public.subscriptions (tenant_id, id)
  on delete restrict,
  add constraint payments_subscription_level_ck
  check (subscription_id is null or level='platform_billing') not valid,
  add constraint payments_idempotency_key_ck
  check (
    idempotency_key is null
    or length(idempotency_key) between 1 and 160
  ) not valid,
  add constraint payments_platform_effect_status_ck
  check (
    platform_effect_status is null
    or platform_effect_status in ('captured','failed','refunded','chargeback')
  ) not valid;

create unique index if not exists payments_platform_idempotency_uidx
  on public.payments (tenant_id, idempotency_key)
  where level='platform_billing' and idempotency_key is not null;

create index if not exists payments_platform_subscription_idx
  on public.payments (tenant_id, subscription_id, created_at desc)
  where level='platform_billing' and subscription_id is not null;

comment on column public.plans.billing_interval is
  'Intervalo real do plano Kataluu. NULL significa configuração comercial incompleta.';
comment on column public.payments.idempotency_key is
  'Chave lógica server-side da cobrança platform_billing; nunca definida pelo browser.';
comment on column public.payments.provider_create_started_at is
  'Claim server-side para impedir chamadas concorrentes duplicadas ao provider.';
comment on column public.payments.platform_effect_status is
  'Último estado financeiro já aplicado idempotentemente à assinatura platform_billing.';
