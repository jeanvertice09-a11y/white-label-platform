-- Phase 16: White Label -> merchant billing (tenant_billing only).
-- Additive hardening. Does not alter 0019/0021/0022/0023 and seeds no commercial data.

alter table public.payments
  add column if not exists store_subscription_id uuid,
  add column if not exists tenant_effect_status text;

alter table public.payments
  add constraint payments_store_subscription_scope_fk
  foreign key (tenant_id, store_id, store_subscription_id)
  references public.store_subscriptions (tenant_id, store_id, id)
  on delete restrict,
  add constraint payments_store_subscription_level_ck
  check (
    store_subscription_id is null
    or (
      level='tenant_billing'
      and store_id is not null
      and subscription_id is null
      and order_id is null
    )
  ) not valid,
  add constraint payments_tenant_effect_status_ck
  check (
    tenant_effect_status is null
    or tenant_effect_status in ('captured','failed','refunded','chargeback')
  ) not valid;

create unique index if not exists payments_tenant_idempotency_uidx
  on public.payments (tenant_id, store_id, idempotency_key)
  where level='tenant_billing' and idempotency_key is not null;

create index if not exists payments_tenant_subscription_idx
  on public.payments (tenant_id, store_id, store_subscription_id, created_at desc)
  where level='tenant_billing' and store_subscription_id is not null;

comment on column public.payments.store_subscription_id is
  'Assinatura comercial da store para cobranças tenant_billing; derivada server-side.';
comment on column public.payments.tenant_effect_status is
  'Último estado financeiro aplicado idempotentemente à store_subscription tenant_billing.';
