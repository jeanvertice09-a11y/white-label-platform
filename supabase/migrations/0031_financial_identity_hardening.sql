-- 0031_financial_identity_hardening.sql
-- Bind webhook identity to the provider declared by its gateway account.
-- This closes the service-role path where an internally persisted event could
-- pair an Asaas/Mercado Pago provider name with an account of the other provider.

alter table public.gateway_accounts
  add constraint gateway_accounts_provider_id_uidx unique (provider, id);

alter table public.webhook_events
  drop constraint if exists webhook_events_gateway_account_id_fkey,
  add constraint webhook_events_provider_gateway_fk
    foreign key (provider, gateway_account_id)
    references public.gateway_accounts (provider, id)
    on delete set null (gateway_account_id);

comment on constraint webhook_events_provider_gateway_fk on public.webhook_events is
  'Webhook provider must match the provider of the gateway account, including service-role writes.';
