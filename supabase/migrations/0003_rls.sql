-- 0003_rls.sql — RLS deny-by-default + membership via auth.uid().
-- Estratégia: sem SET LOCAL/current_setting (falsa segurança). As políticas
-- usam auth.uid() do JWT do Supabase Auth — funciona na mesma conexão HTTP.
-- Leitura pública de catálogo: NEGADA por padrão; a abstração de catálogo
-- público será servida por função/endpoint tenant/store-scoped documentado.

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.platform_members enable row level security;
alter table public.tenant_branding enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_settings enable row level security;
alter table public.domains enable row level security;
alter table public.audit_logs enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.media_assets enable row level security;
alter table public.subscriptions enable row level security;
alter table public.gateway_accounts enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;

-- Helpers SECURITY DEFINER mínimos (2 funções, com proteções).
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = p_tenant_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.store_members m
    where m.store_id = p_store_id and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.is_store_member(uuid) from public;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.is_store_member(uuid) to authenticated;

-- Sem políticas permissivas = deny-by-default. Adicionamos leitura por membership:
create policy tenants_member_read on public.tenants
  for select to authenticated using (public.is_tenant_member(id));

create policy stores_member_read on public.stores
  for select to authenticated using (public.is_store_member(id));

create policy products_member_read on public.products
  for select to authenticated using (public.is_store_member(store_id));

create policy orders_member_read on public.orders
  for select to authenticated using (public.is_store_member(store_id));

-- Escrita: apenas via service_role em server/worker (sem policy p/ authenticated = negado).
-- Catálogo público: endpoint dedicado com DomainResolver + query tenant-scoped.
