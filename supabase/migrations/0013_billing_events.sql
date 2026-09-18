-- 0013_billing_events.sql
-- Base rastreável e idempotente para eventos/faturas. Não automatiza cobrança.

create table public.platform_billing_rates (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  unit_cents bigint not null check (unit_cents >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  constraint platform_billing_rates_metric_ck check (metric_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint platform_billing_rates_period_ck check (
    effective_to is null or effective_to > effective_from
  ),
  unique (metric_key, effective_from)
);

create index platform_billing_rates_lookup_idx
  on public.platform_billing_rates (metric_key, active, effective_from desc);

create table public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('platform_billing', 'tenant_billing')),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  store_id uuid,
  period_start timestamptz not null,
  period_end timestamptz not null,
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft', 'open', 'paid', 'void')),
  external_invoice_id text,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id) on delete cascade,
  unique (level, tenant_id, store_id, id),
  constraint billing_invoices_period_ck check (period_end > period_start),
  constraint billing_invoices_scope_ck check (
    (level = 'platform_billing' and store_id is null)
    or (level = 'tenant_billing' and store_id is not null)
  )
);

create index billing_invoices_scope_period_idx
  on public.billing_invoices (level, tenant_id, store_id, period_start desc);
create index billing_invoices_status_idx
  on public.billing_invoices (level, status, created_at desc);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('platform_billing', 'tenant_billing')),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  store_id uuid,
  invoice_id uuid references public.billing_invoices (id) on delete set null,
  event_type text not null,
  quantity bigint not null check (quantity > 0),
  unit_cents bigint not null check (unit_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'invoiced', 'void')),
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id) on delete cascade,
  constraint billing_events_type_ck check (event_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint billing_events_idempotency_ck check (length(idempotency_key) between 1 and 160),
  constraint billing_events_period_ck check (period_end > period_start),
  constraint billing_events_total_ck check (total_cents = quantity * unit_cents),
  constraint billing_events_scope_ck check (
    (level = 'platform_billing' and store_id is null)
    or (level = 'tenant_billing' and store_id is not null)
  )
);

create unique index billing_events_idempotency_uidx
  on public.billing_events (
    level,
    tenant_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    idempotency_key
  );
create index billing_events_scope_period_idx
  on public.billing_events (level, tenant_id, store_id, period_start desc);
create index billing_events_invoice_idx
  on public.billing_events (invoice_id)
  where invoice_id is not null;

create or replace function public.enforce_billing_event_invoice_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_level text;
  v_tenant uuid;
  v_store uuid;
begin
  if NEW.invoice_id is null then
    return NEW;
  end if;

  select level, tenant_id, store_id
    into v_level, v_tenant, v_store
  from public.billing_invoices
  where id = NEW.invoice_id;

  if not found then
    raise exception 'billing event: invoice inexistente';
  end if;
  if v_level is distinct from NEW.level
    or v_tenant is distinct from NEW.tenant_id
    or v_store is distinct from NEW.store_id then
    raise exception 'billing event: invoice pertence a outro nível/escopo';
  end if;

  return NEW;
end;
$$;

drop trigger if exists billing_event_invoice_scope_trg on public.billing_events;
create trigger billing_event_invoice_scope_trg
  before insert or update on public.billing_events
  for each row execute function public.enforce_billing_event_invoice_scope();

alter table public.platform_billing_rates enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_events enable row level security;
