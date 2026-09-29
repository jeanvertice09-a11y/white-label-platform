-- 0019_secure_gateway_accounts.sql
-- Fundação segura de gateway accounts. Sem cobrança real e sem integração externa.
-- Segredos cifrados ficam fora do schema public/Data API.

alter table public.gateway_accounts
  add column public_identifier text,
  add column status text not null default 'disabled',
  add column updated_at timestamptz not null default now(),
  add constraint gateway_accounts_status_ck
    check (status in ('active', 'disabled')),
  add constraint gateway_accounts_public_identifier_ck
    check (
      public_identifier is null
      or (length(btrim(public_identifier)) between 1 and 255)
    );

create index gateway_accounts_tenant_level_status_idx
  on public.gateway_accounts (tenant_id, level, status, created_at desc);

create index gateway_accounts_store_level_status_idx
  on public.gateway_accounts (tenant_id, store_id, level, status, created_at desc)
  where store_id is not null;

create table private.gateway_account_secrets (
  gateway_account_id uuid primary key
    references public.gateway_accounts (id) on delete cascade,
  credentials_ciphertext text,
  webhook_secret_ciphertext text,
  updated_at timestamptz not null default now(),
  constraint gateway_account_secrets_credentials_ck
    check (
      credentials_ciphertext is null
      or length(credentials_ciphertext) > 0
    ),
  constraint gateway_account_secrets_webhook_ck
    check (
      webhook_secret_ciphertext is null
      or length(webhook_secret_ciphertext) > 0
    )
);

insert into private.gateway_account_secrets (gateway_account_id)
select id from public.gateway_accounts
on conflict (gateway_account_id) do nothing;

alter table private.gateway_account_secrets enable row level security;

revoke all on table private.gateway_account_secrets from public;
revoke all on table private.gateway_account_secrets from anon;
revoke all on table private.gateway_account_secrets from authenticated;

comment on table private.gateway_account_secrets is
  'Ciphertexts de credenciais de gateways. Acesso somente server-side por conexão administrativa.';
comment on column private.gateway_account_secrets.credentials_ciphertext is
  'Envelope autenticado e versionado produzido pelo CredentialVault.';
comment on column private.gateway_account_secrets.webhook_secret_ciphertext is
  'Webhook secret cifrado; nunca retornar ao browser ou auditoria.';
