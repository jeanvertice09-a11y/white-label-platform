-- 0033_financial_invariants_hardening.sql
-- Preserve financial identity and payment-state monotonicity at the database boundary,
-- including writes performed through service_role.

create or replace function public.enforce_gateway_account_financial_identity()
returns trigger
language plpgsql
set search_path = public
as $$
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
returns trigger
language plpgsql
set search_path = public
as $$
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
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;
  if not (
    (OLD.status = 'pending' and NEW.status in ('authorized','captured','failed','refunded','chargeback'))
    or (OLD.status = 'authorized' and NEW.status in ('captured','failed','refunded','chargeback'))
    or (OLD.status = 'captured' and NEW.status in ('refunded','chargeback'))
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
