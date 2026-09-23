-- Ensure each White Label has a single active gateway receiving merchant plan payments.
create unique index gateway_accounts_one_active_tenant_billing_uidx
  on public.gateway_accounts(tenant_id)
  where level='tenant_billing' and store_id is null and status='active';

create index tenant_billing_provider_customers_scope_idx
  on private.tenant_billing_provider_customers(tenant_id,store_id);
