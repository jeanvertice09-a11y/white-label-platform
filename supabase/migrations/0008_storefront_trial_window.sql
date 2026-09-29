-- 0008_storefront_trial_window.sql — validade opcional do trial para o catálogo público.
-- Compatibilidade: trial_ends_at NULL mantém tenants legados em status trial utilizáveis.

alter table public.tenants
  add column if not exists trial_ends_at timestamptz;

create index if not exists tenants_trial_status_idx
  on public.tenants (status, trial_ends_at)
  where status = 'trial';
