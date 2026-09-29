-- Ensure each White Label has a single active gateway receiving merchant plan payments.
create index tenant_billing_provider_customers_scope_idx
  on private.tenant_billing_provider_customers(tenant_id,store_id);
