-- 0012_commercial_plans_entitlements.sql
-- Base comercial White Label -> lojista: templates Kataluu, planos do tenant,
-- assinaturas da store, trial e entitlements centralizados.

-- ---------- REGISTRO CENTRAL DE ENTITLEMENTS ----------
create table public.entitlement_definitions (
  key text primary key,
  kind text not null check (kind in ('feature', 'limit')),
  name text not null,
  description text,
  unit text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint entitlement_key_ck check (key ~ '^[a-z][a-z0-9_]{1,63}$')
);

insert into public.entitlement_definitions (key, kind, name, unit) values
  ('products', 'feature', 'Produtos', null),
  ('variants', 'feature', 'Variantes', null),
  ('orders', 'feature', 'Pedidos', null),
  ('customers', 'feature', 'Clientes', null),
  ('inventory', 'feature', 'Estoque', null),
  ('finance', 'feature', 'Financeiro', null),
  ('purchases', 'feature', 'Compras', null),
  ('suppliers', 'feature', 'Fornecedores', null),
  ('coupons', 'feature', 'Cupons', null),
  ('campaigns', 'feature', 'Campanhas', null),
  ('reports', 'feature', 'Relatórios', null),
  ('custom_domain', 'feature', 'Domínio personalizado', null),
  ('banners', 'feature', 'Banners', null),
  ('layouts', 'feature', 'Layouts', null),
  ('meta_pixel', 'feature', 'Meta Pixel', null),
  ('online_payments', 'feature', 'Pagamentos online', null),
  ('mercadopago', 'feature', 'Mercado Pago', null),
  ('shipping', 'feature', 'Frete', null),
  ('melhor_envio', 'feature', 'Melhor Envio', null),
  ('team_users', 'feature', 'Usuários e equipe', null),
  ('automations', 'feature', 'Automações', null),
  ('integrations', 'feature', 'Integrações', null),
  ('max_products', 'limit', 'Máximo de produtos', 'items'),
  ('max_users', 'limit', 'Máximo de usuários', 'users'),
  ('max_stores', 'limit', 'Máximo de lojas', 'stores'),
  ('max_storage_bytes', 'limit', 'Armazenamento máximo', 'bytes')
on conflict (key) do nothing;

-- ---------- TEMPLATES DEFINIDOS PELA KATALUU ----------
create table public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_templates_code_ck check (code ~ '^[a-z][a-z0-9_]{1,63}$')
);

insert into public.plan_templates (code, name, description, sort_order) values
  ('free', 'Grátis', 'Modelo gratuito definido pela Kataluu.', 0),
  ('monthly_entry', 'Entrada', 'Modelo mensal de entrada.', 10),
  ('monthly_intermediate', 'Intermediário', 'Modelo mensal intermediário.', 20),
  ('monthly_complete', 'Completo', 'Modelo mensal avançado/completo.', 30)
on conflict (code) do nothing;

create table public.plan_template_entitlements (
  template_id uuid not null references public.plan_templates (id) on delete cascade,
  entitlement_key text not null references public.entitlement_definitions (key) on delete restrict,
  enabled boolean,
  limit_value bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (template_id, entitlement_key),
  constraint plan_template_limit_nonnegative_ck check (limit_value is null or limit_value >= 0)
);

create or replace function public.validate_plan_template_entitlement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_kind text;
begin
  select kind into v_kind
  from public.entitlement_definitions
  where key = NEW.entitlement_key and active = true;

  if v_kind is null then
    raise exception 'entitlement template: definição inexistente ou inativa';
  end if;

  if v_kind = 'feature' then
    if NEW.enabled is null or NEW.limit_value is not null then
      raise exception 'entitlement template: feature exige enabled e não aceita limit_value';
    end if;
  else
    if NEW.enabled is not null or NEW.limit_value is null or NEW.limit_value < 0 then
      raise exception 'entitlement template: limit exige limit_value >= 0 e não aceita enabled';
    end if;
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists plan_template_entitlement_validate_trg on public.plan_template_entitlements;
create trigger plan_template_entitlement_validate_trg
  before insert or update on public.plan_template_entitlements
  for each row execute function public.validate_plan_template_entitlement();

-- ---------- PLANO COMERCIAL DO WHITE LABEL ----------
create table public.tenant_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_id uuid not null references public.plan_templates (id) on delete restrict,
  slug text not null,
  name text not null,
  description text,
  price_cents bigint not null check (price_cents >= 0),
  billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly', 'quarterly', 'yearly')),
  active boolean not null default true,
  trial_enabled boolean not null default false,
  trial_days integer not null default 0 check (trial_days between 0 and 365),
  display_order integer not null default 0 check (display_order >= 0),
  recommended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, slug),
  unique (tenant_id, template_id),
  constraint tenant_plans_slug_ck check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint tenant_plans_trial_ck check (
    (trial_enabled = false and trial_days = 0)
    or (trial_enabled = true and trial_days between 1 and 365)
  )
);

create index tenant_plans_list_idx
  on public.tenant_plans (tenant_id, active, display_order, created_at);

create table public.tenant_plan_entitlements (
  tenant_id uuid not null,
  tenant_plan_id uuid not null,
  entitlement_key text not null references public.entitlement_definitions (key) on delete restrict,
  enabled boolean,
  limit_value bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_plan_id, entitlement_key),
  foreign key (tenant_id, tenant_plan_id)
    references public.tenant_plans (tenant_id, id) on delete cascade,
  constraint tenant_plan_limit_nonnegative_ck check (limit_value is null or limit_value >= 0)
);

create index tenant_plan_entitlements_scope_idx
  on public.tenant_plan_entitlements (tenant_id, tenant_plan_id);

create or replace function public.validate_tenant_plan_entitlement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_template_id uuid;
  v_kind text;
  v_template_enabled boolean;
  v_template_limit bigint;
begin
  select p.template_id, d.kind, te.enabled, te.limit_value
    into v_template_id, v_kind, v_template_enabled, v_template_limit
  from public.tenant_plans p
  join public.entitlement_definitions d
    on d.key = NEW.entitlement_key and d.active = true
  left join public.plan_template_entitlements te
    on te.template_id = p.template_id and te.entitlement_key = NEW.entitlement_key
  where p.tenant_id = NEW.tenant_id and p.id = NEW.tenant_plan_id;

  if v_template_id is null or v_kind is null then
    raise exception 'tenant plan entitlement: plano/entitlement inválido';
  end if;

  if v_kind = 'feature' then
    if NEW.enabled is null or NEW.limit_value is not null then
      raise exception 'tenant plan entitlement: feature exige enabled';
    end if;
    if NEW.enabled = true and coalesce(v_template_enabled, false) = false then
      raise exception 'tenant plan entitlement: feature não autorizada pelo template Kataluu';
    end if;
  else
    if NEW.enabled is not null or NEW.limit_value is null or NEW.limit_value < 0 then
      raise exception 'tenant plan entitlement: limit exige valor não negativo';
    end if;
    if v_template_limit is null or NEW.limit_value > v_template_limit then
      raise exception 'tenant plan entitlement: limite excede teto autorizado pela Kataluu';
    end if;
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists tenant_plan_entitlement_validate_trg on public.tenant_plan_entitlements;
create trigger tenant_plan_entitlement_validate_trg
  before insert or update on public.tenant_plan_entitlements
  for each row execute function public.validate_tenant_plan_entitlement();

-- ---------- ASSINATURA DO LOJISTA ----------
create table public.store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'tenant_billing' check (level = 'tenant_billing'),
  tenant_id uuid not null,
  store_id uuid not null,
  tenant_plan_id uuid not null,
  status text not null default 'active'
    check (status in ('trialing', 'active', 'past_due', 'suspended', 'canceled', 'expired')),
  started_at timestamptz not null default now(),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id) on delete cascade,
  foreign key (tenant_id, tenant_plan_id)
    references public.tenant_plans (tenant_id, id) on delete restrict,
  unique (tenant_id, store_id, id),
  constraint store_subscriptions_trial_window_ck check (
    (trial_started_at is null and trial_ends_at is null)
    or (trial_started_at is not null and trial_ends_at is not null and trial_ends_at > trial_started_at)
  )
);

create unique index store_subscriptions_current_uidx
  on public.store_subscriptions (tenant_id, store_id)
  where status in ('trialing', 'active', 'past_due', 'suspended');
create index store_subscriptions_plan_idx
  on public.store_subscriptions (tenant_id, tenant_plan_id, created_at desc);
create index store_subscriptions_status_idx
  on public.store_subscriptions (tenant_id, store_id, status, created_at desc);

create or replace function public.initialize_store_subscription()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_active boolean;
  v_trial_enabled boolean;
  v_trial_days integer;
begin
  select active, trial_enabled, trial_days
    into v_active, v_trial_enabled, v_trial_days
  from public.tenant_plans
  where tenant_id = NEW.tenant_id and id = NEW.tenant_plan_id;

  if not found then
    raise exception 'store subscription: plano não pertence ao tenant';
  end if;

  if TG_OP = 'INSERT' then
    if v_active = false then
      raise exception 'store subscription: plano inativo não aceita nova assinatura';
    end if;

    NEW.started_at := coalesce(NEW.started_at, now());
    if NEW.status = 'trialing' then
      if v_trial_enabled = false or v_trial_days <= 0 then
        raise exception 'store subscription: trial não habilitado para o plano';
      end if;
      NEW.trial_started_at := now();
      NEW.trial_ends_at := now() + make_interval(days => v_trial_days);
    else
      NEW.trial_started_at := null;
      NEW.trial_ends_at := null;
    end if;
  else
    if NEW.tenant_id is distinct from OLD.tenant_id
      or NEW.store_id is distinct from OLD.store_id
      or NEW.tenant_plan_id is distinct from OLD.tenant_plan_id then
      raise exception 'store subscription: escopo e plano são imutáveis';
    end if;

    if OLD.status in ('canceled', 'expired') and NEW.status is distinct from OLD.status then
      raise exception 'store subscription: assinatura encerrada não pode ser reativada';
    end if;

    if NEW.status = 'canceled' and OLD.status <> 'canceled' then
      NEW.canceled_at := coalesce(NEW.canceled_at, now());
    end if;
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists store_subscription_init_trg on public.store_subscriptions;
create trigger store_subscription_init_trg
  before insert or update on public.store_subscriptions
  for each row execute function public.initialize_store_subscription();

-- ---------- RLS: deny-by-default ----------
alter table public.entitlement_definitions enable row level security;
alter table public.plan_templates enable row level security;
alter table public.plan_template_entitlements enable row level security;
alter table public.tenant_plans enable row level security;
alter table public.tenant_plan_entitlements enable row level security;
alter table public.store_subscriptions enable row level security;
