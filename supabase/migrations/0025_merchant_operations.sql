-- 0025_merchant_operations.sql — operações internas da STORE.
-- Não é platform_billing nem tenant_billing. Todo recurso é tenant+store scoped.

-- ---------- FORNECEDORES ----------
create table public.merchant_suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  name text not null,
  trade_name text,
  document text,
  contact_name text,
  phone text,
  whatsapp text,
  email text,
  address text,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id) on delete cascade,
  unique (tenant_id, store_id, id),
  constraint merchant_suppliers_name_ck check (char_length(trim(name)) between 2 and 180),
  constraint merchant_suppliers_status_ck check (status in ('active','inactive')),
  constraint merchant_suppliers_email_ck check (email is null or char_length(email) <= 254),
  constraint merchant_suppliers_notes_ck check (notes is null or char_length(notes) <= 2000)
);
create index merchant_suppliers_lookup_idx
  on public.merchant_suppliers (tenant_id, store_id, status, name);
create index merchant_suppliers_document_idx
  on public.merchant_suppliers (tenant_id, store_id, document)
  where document is not null;

-- ---------- COMPRAS ----------
create table public.merchant_purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  supplier_id uuid,
  purchased_at date not null,
  status text not null default 'draft',
  subtotal_cents bigint not null,
  discount_cents bigint not null default 0,
  surcharge_cents bigint not null default 0,
  total_cents bigint not null,
  notes text,
  created_by uuid not null,
  received_by uuid,
  received_at timestamptz,
  cancelled_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id) on delete cascade,
  foreign key (tenant_id, store_id, supplier_id)
    references public.merchant_suppliers (tenant_id, store_id, id) on delete restrict,
  unique (tenant_id, store_id, id),
  constraint merchant_purchases_status_ck check (status in ('draft','received','cancelled')),
  constraint merchant_purchases_values_ck check (
    subtotal_cents >= 0 and discount_cents >= 0 and surcharge_cents >= 0
    and total_cents >= 0
    and total_cents = subtotal_cents - discount_cents + surcharge_cents
  ),
  constraint merchant_purchases_discount_ck check (discount_cents <= subtotal_cents + surcharge_cents),
  constraint merchant_purchases_notes_ck check (notes is null or char_length(notes) <= 4000),
  constraint merchant_purchases_state_dates_ck check (
    (status='draft' and received_at is null and cancelled_at is null)
    or (status='received' and received_at is not null and cancelled_at is null)
    or (status='cancelled' and cancelled_at is not null and received_at is null)
  )
);
create index merchant_purchases_store_date_idx
  on public.merchant_purchases (tenant_id, store_id, purchased_at desc, created_at desc);
create index merchant_purchases_store_status_idx
  on public.merchant_purchases (tenant_id, store_id, status, purchased_at desc);
create index merchant_purchases_supplier_idx
  on public.merchant_purchases (tenant_id, store_id, supplier_id, purchased_at desc)
  where supplier_id is not null;

create table public.merchant_purchase_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  purchase_id uuid not null,
  product_id uuid not null,
  variant_id uuid,
  product_name text not null,
  variant_name text,
  sku text,
  quantity integer not null,
  unit_cost_cents bigint not null,
  subtotal_cents bigint not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id, purchase_id)
    references public.merchant_purchases (tenant_id, store_id, id) on delete cascade,
  foreign key (tenant_id, store_id, product_id)
    references public.products (tenant_id, store_id, id) on delete restrict,
  foreign key (tenant_id, store_id, product_id, variant_id)
    references public.product_variants (tenant_id, store_id, product_id, id) on delete restrict,
  unique (tenant_id, store_id, id),
  unique nulls not distinct (tenant_id, store_id, purchase_id, product_id, variant_id),
  constraint merchant_purchase_items_qty_ck check (quantity > 0),
  constraint merchant_purchase_items_cost_ck check (unit_cost_cents >= 0),
  constraint merchant_purchase_items_subtotal_ck check (subtotal_cents = quantity::bigint * unit_cost_cents)
);
create index merchant_purchase_items_purchase_idx
  on public.merchant_purchase_items (tenant_id, store_id, purchase_id);
create index merchant_purchase_items_product_idx
  on public.merchant_purchase_items (tenant_id, store_id, product_id, variant_id);

-- ---------- FINANCEIRO INTERNO DA STORE ----------
create table public.merchant_financial_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  name text not null,
  direction text not null default 'both',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id) on delete cascade,
  unique (tenant_id, store_id, id),
  constraint merchant_financial_categories_name_ck check (char_length(trim(name)) between 2 and 100),
  constraint merchant_financial_categories_direction_ck check (direction in ('income','expense','both'))
);
create unique index merchant_financial_categories_name_uidx
  on public.merchant_financial_categories (tenant_id, store_id, lower(name));

create table public.merchant_financial_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  direction text not null,
  category_id uuid,
  description text not null,
  amount_cents bigint not null,
  due_at date not null,
  competence_date date not null,
  status text not null default 'open',
  settled_at timestamptz,
  supplier_id uuid,
  customer_id uuid,
  order_id uuid,
  purchase_id uuid,
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id) on delete cascade,
  foreign key (tenant_id, store_id, category_id)
    references public.merchant_financial_categories (tenant_id, store_id, id) on delete restrict,
  foreign key (tenant_id, store_id, supplier_id)
    references public.merchant_suppliers (tenant_id, store_id, id) on delete restrict,
  foreign key (tenant_id, store_id, customer_id)
    references public.customers (tenant_id, store_id, id) on delete restrict,
  foreign key (tenant_id, store_id, order_id)
    references public.orders (tenant_id, store_id, id) on delete restrict,
  foreign key (tenant_id, store_id, purchase_id)
    references public.merchant_purchases (tenant_id, store_id, id) on delete restrict,
  unique (tenant_id, store_id, id),
  constraint merchant_financial_entries_direction_ck check (direction in ('receivable','payable')),
  constraint merchant_financial_entries_status_ck check (status in ('open','settled','cancelled')),
  constraint merchant_financial_entries_amount_ck check (amount_cents > 0),
  constraint merchant_financial_entries_description_ck check (char_length(trim(description)) between 2 and 240),
  constraint merchant_financial_entries_notes_ck check (notes is null or char_length(notes) <= 4000),
  constraint merchant_financial_entries_settlement_ck check (
    (status='settled' and settled_at is not null)
    or (status in ('open','cancelled') and settled_at is null)
  )
);
create index merchant_financial_entries_due_idx
  on public.merchant_financial_entries (tenant_id, store_id, direction, status, due_at);
create index merchant_financial_entries_competence_idx
  on public.merchant_financial_entries (tenant_id, store_id, competence_date, direction);
create index merchant_financial_entries_supplier_idx
  on public.merchant_financial_entries (tenant_id, store_id, supplier_id)
  where supplier_id is not null;
create index merchant_financial_entries_customer_idx
  on public.merchant_financial_entries (tenant_id, store_id, customer_id)
  where customer_id is not null;

-- ---------- TAREFAS OPERACIONAIS ----------
create table public.merchant_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  title text not null,
  description text,
  priority text not null default 'normal',
  status text not null default 'open',
  due_at timestamptz,
  assignee_user_id uuid,
  created_by uuid not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id)
    references public.stores (tenant_id, id) on delete cascade,
  foreign key (store_id, assignee_user_id)
    references public.store_members (store_id, user_id) on delete set null (assignee_user_id),
  foreign key (store_id, created_by)
    references public.store_members (store_id, user_id) on delete restrict,
  unique (tenant_id, store_id, id),
  constraint merchant_tasks_title_ck check (char_length(trim(title)) between 2 and 180),
  constraint merchant_tasks_description_ck check (description is null or char_length(description) <= 4000),
  constraint merchant_tasks_priority_ck check (priority in ('low','normal','high')),
  constraint merchant_tasks_status_ck check (status in ('open','done')),
  constraint merchant_tasks_completion_ck check (
    (status='done' and completed_at is not null)
    or (status='open' and completed_at is null)
  )
);
create index merchant_tasks_store_status_idx
  on public.merchant_tasks (tenant_id, store_id, status, due_at, priority);
create index merchant_tasks_assignee_idx
  on public.merchant_tasks (tenant_id, store_id, assignee_user_id, status)
  where assignee_user_id is not null;

-- ---------- RLS ----------
-- Igual aos demais módulos operacionais: browser não é autoridade. O boundary
-- server-side autoriza membership/RBAC e usa service_role com queries sempre
-- tenant+store scoped. Sem policy authenticated => deny-by-default.
alter table public.merchant_suppliers enable row level security;
alter table public.merchant_purchases enable row level security;
alter table public.merchant_purchase_items enable row level security;
alter table public.merchant_financial_categories enable row level security;
alter table public.merchant_financial_entries enable row level security;
alter table public.merchant_tasks enable row level security;
