-- 0014_billing_level_hardening.sql
-- Separa definitivamente os modelos de assinatura sem apagar legado existente.
-- subscriptions: Kataluu -> White Label (platform_billing)
-- store_subscriptions: White Label -> lojista (tenant_billing)

alter table public.subscriptions
  add constraint subscriptions_platform_only_ck
  check (level = 'platform_billing') not valid;

create index if not exists subscriptions_platform_tenant_status_idx
  on public.subscriptions (tenant_id, status, created_at desc)
  where level = 'platform_billing';

comment on table public.subscriptions is
  'Assinaturas Kataluu -> White Label. Novos registros devem usar level=platform_billing.';
comment on table public.store_subscriptions is
  'Assinaturas White Label -> lojista/store. Nível financeiro tenant_billing.';
