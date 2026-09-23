-- 0042_order_payment_lifecycle_hardening.sql
-- Defense in depth for store checkout financial/order consistency.

create or replace function public.enforce_store_checkout_payment_order()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  o_total bigint;
begin
  if NEW.level <> 'store_checkout' or NEW.order_id is null then
    return NEW;
  end if;
  select o.total_cents into o_total
  from public.orders o
  where o.tenant_id=NEW.tenant_id and o.store_id=NEW.store_id and o.id=NEW.order_id;
  if not found then
    raise exception 'payments: pedido store_checkout inexistente no escopo';
  end if;
  if NEW.amount_cents is distinct from o_total then
    raise exception 'payments: valor diverge do total do pedido';
  end if;
  return NEW;
end;
$$;

drop trigger if exists payments_store_checkout_order_trg on public.payments;
create trigger payments_store_checkout_order_trg
  before insert or update of tenant_id,store_id,order_id,amount_cents,level on public.payments
  for each row execute function public.enforce_store_checkout_payment_order();

create or replace function public.enforce_order_payment_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.status='cancelled' and OLD.status is distinct from 'cancelled'
     and OLD.payment_status in ('paid','refunded') then
    raise exception 'orders: cancelamento exige resolução financeira prévia';
  end if;
  return NEW;
end;
$$;

drop trigger if exists orders_payment_lifecycle_trg on public.orders;
create trigger orders_payment_lifecycle_trg
  before update of status on public.orders
  for each row execute function public.enforce_order_payment_lifecycle();
