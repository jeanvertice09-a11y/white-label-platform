-- 0036_mercadopago_store_oauth.sql
-- OAuth Mercado Pago + checkout Pix por loja. Segredos e estados ficam fora da Data API.
alter table private.gateway_account_secrets
  add column oauth_refresh_token_ciphertext text,
  add column oauth_access_token_expires_at timestamptz;
create table private.mercadopago_oauth_states (
  state_hash text primary key, tenant_id uuid not null, store_id uuid not null, actor_user_id uuid not null,
  code_verifier_ciphertext text not null, return_url text not null, expires_at timestamptz not null,
  consumed_at timestamptz, created_at timestamptz not null default now(),
  constraint mp_oauth_state_expiry_ck check (expires_at > created_at),
  constraint mp_oauth_state_return_url_ck check (return_url ~ '^https://')
);
create index mercadopago_oauth_states_expiry_idx on private.mercadopago_oauth_states (expires_at) where consumed_at is null;
alter table private.mercadopago_oauth_states enable row level security;
revoke all on table private.mercadopago_oauth_states from public, anon, authenticated;
create unique index gateway_accounts_store_provider_level_uidx
  on public.gateway_accounts (tenant_id, store_id, provider, level) where level='store_checkout';
alter table public.payments
  add column checkout_qr_code text,
  add column checkout_qr_code_base64 text,
  add column checkout_ticket_url text,
  add column checkout_expires_at timestamptz;
create unique index payments_store_checkout_order_uidx
  on public.payments (tenant_id, store_id, order_id) where level='store_checkout' and order_id is not null;
comment on table private.mercadopago_oauth_states is 'Estados OAuth/PKCE de uso único. Somente backend administrativo.';
