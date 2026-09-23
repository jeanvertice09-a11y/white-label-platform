-- Complete White Label -> merchant billing profile and provider-customer mapping.
create table public.store_billing_profiles (
  tenant_id uuid not null,
  store_id uuid not null,
  legal_name text not null,
  tax_id text not null,
  billing_email text not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id,store_id),
  foreign key (tenant_id,store_id) references public.stores(tenant_id,id) on delete cascade,
  constraint store_billing_profiles_name_ck check (length(btrim(legal_name)) between 2 and 160),
  constraint store_billing_profiles_tax_ck check (tax_id ~ '^[0-9]{11}$|^[0-9]{14}$'),
  constraint store_billing_profiles_email_ck check (billing_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')
);
alter table public.store_billing_profiles enable row level security;
revoke all on table public.store_billing_profiles from public,anon,authenticated;

create table private.tenant_billing_provider_customers (
  gateway_account_id uuid not null references public.gateway_accounts(id) on delete cascade,
  tenant_id uuid not null,
  store_id uuid not null,
  provider text not null,
  provider_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (gateway_account_id,store_id),
  foreign key (tenant_id,store_id) references public.stores(tenant_id,id) on delete cascade,
  constraint tenant_billing_provider_customer_provider_ck check (provider in ('asaas'))
);
create unique index tenant_billing_provider_customer_uidx
  on private.tenant_billing_provider_customers(gateway_account_id,provider_customer_id);
alter table private.tenant_billing_provider_customers enable row level security;
revoke all on table private.tenant_billing_provider_customers from public,anon,authenticated;
comment on table private.tenant_billing_provider_customers is 'Mapeamento server-only do pagador da loja na conta Asaas da White Label.';
