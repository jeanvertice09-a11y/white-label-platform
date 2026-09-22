-- Lote SENTINEL 01: hardening de identidade financeira multi-tenant/provider.
-- Mantém o desenho atual e move invariantes críticas para o banco, inclusive para service_role.

alter table public.gateway_accounts
  add constraint gateway_accounts_provider_id_uidx unique (provider, id);

alter table public.webhook_events
  add constraint webhook_events_provider_gateway_fk
  foreign key (provider, gateway_account_id)
  references public.gateway_accounts(provider, id);

create or replace function public.enforce_gateway_account_financial_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.level is distinct from OLD.level
     or NEW.tenant_id is distinct from OLD.tenant_id
     or NEW.store_id is distinct from OLD.store_id
     or NEW.provider is distinct from OLD.provider then
    raise exception 'gateway_accounts: identidade financeira é imutável';
  end if;
  return NEW;
end;
$$;

drop trigger if exists gateway_accounts_financial_identity_trg on public.gateway_accounts;
create trigger gateway_accounts_financial_identity_trg
  before update on public.gateway_accounts
  for each row execute function public.enforce_gateway_account_financial_identity();

create or replace function public.enforce_payment_financial_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.level is distinct from OLD.level
     or NEW.tenant_id is distinct from OLD.tenant_id
     or NEW.store_id is distinct from OLD.store_id
     or NEW.gateway_account_id is distinct from OLD.gateway_account_id then
    raise exception 'payments: identidade financeira é imutável';
  end if;
  if OLD.provider_payment_id is not null
     and NEW.provider_payment_id is distinct from OLD.provider_payment_id then
    raise exception 'payments: provider_payment_id já vinculado é imutável';
  end if;
  return NEW;
end;
$$;

drop trigger if exists payments_financial_identity_trg on public.payments;
create trigger payments_financial_identity_trg
  before update on public.payments
  for each row execute function public.enforce_payment_financial_identity();

create or replace function public.enforce_payment_status_transition()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.status is not distinct from OLD.status then return NEW; end if;
  if not (
    (OLD.status='pending' and NEW.status in ('authorized','captured','failed','refunded','chargeback'))
    or (OLD.status='authorized' and NEW.status in ('captured','failed','refunded','chargeback'))
    or (OLD.status='captured' and NEW.status in ('refunded','chargeback'))
  ) then
    raise exception 'payments: transição de status inválida (% -> %)', OLD.status, NEW.status;
  end if;
  return NEW;
end;
$$;

drop trigger if exists payments_status_transition_trg on public.payments;
create trigger payments_status_transition_trg
  before update of status on public.payments
  for each row execute function public.enforce_payment_status_transition();

comment on constraint webhook_events_provider_gateway_fk on public.webhook_events is
  'Evento só pode existir sob gateway do mesmo provider; gateway determina tenant/store e credencial.';
