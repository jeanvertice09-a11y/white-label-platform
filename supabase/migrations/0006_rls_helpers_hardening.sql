-- 0006_rls_helpers_hardening.sql — hardening RLS helpers + plans RLS
-- Problema: Security Advisor detectou que anon consegue EXECUTE em
-- public.is_tenant_member(uuid) e public.is_store_member(uuid).
-- Causa: grant para authenticated não revoga implicitamente de anon
-- se o role anon herdou de public ou houve grant default.
-- Solução: mover helpers para schema privado (private) + grants mínimos.
-- Não quebra policies existentes (atualizam referência).
-- Não altera regras de negócio.
-- Adicional: RLS explícito em public.plans (evita depender de rls_auto_enable).

-- 1. Criar schema privado se não existir
create schema if not exists private;

-- 2. Mover função is_tenant_member para private
-- search_path mínimo: apenas pg_catalog (evita qualificação inesperada).
-- Tabelas public.tenant_members e auth.uid() já são totalmente qualificadas.
create or replace function private.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog
stable
as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = p_tenant_id and m.user_id = auth.uid()
  );
$$;

-- 3. Mover função is_store_member para private
create or replace function private.is_store_member(p_store_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog
stable
as $$
  select exists (
    select 1 from public.store_members m
    where m.store_id = p_store_id and m.user_id = auth.uid()
  );
$$;

-- 4. Revogar tudo de public e anon nas funções privadas
revoke all on function private.is_tenant_member(uuid) from public;
revoke all on function private.is_store_member(uuid) from public;

-- 5. Grant apenas para authenticated (não para anon, não para public)
grant execute on function private.is_tenant_member(uuid) to authenticated;
grant execute on function private.is_store_member(uuid) to authenticated;

-- 6. Atualizar policies para usar private.is_tenant_member / private.is_store_member
drop policy if exists tenants_member_read on public.tenants;
create policy tenants_member_read on public.tenants
  for select to authenticated using (private.is_tenant_member(id));

drop policy if exists stores_member_read on public.stores;
create policy stores_member_read on public.stores
  for select to authenticated using (private.is_store_member(id));

drop policy if exists products_member_read on public.products;
create policy products_member_read on public.products
  for select to authenticated using (private.is_store_member(store_id));

drop policy if exists orders_member_read on public.orders;
create policy orders_member_read on public.orders
  for select to authenticated using (private.is_store_member(store_id));

-- 7. Remover funções antigas do schema public (limpeza)
drop function if exists public.is_tenant_member(uuid);
drop function if exists public.is_store_member(uuid);

-- 8. Garantir que schema private não seja acessível via PostgREST (RPC)
-- PostgREST expõe apenas schema 'public' por padrão (db-schema config).
-- Nenhum grant para anon/public no schema private.
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

-- 9. RLS EXPLÍCITO em public.plans
-- Evita depender de rls_auto_enable (função gerenciada pelo Supabase).
-- Tabela plans é catálogo global de planos (não tenant-scoped).
-- Leitura: authenticated pode ver planos (sem restrição de tenant).
-- Escrita: apenas service_role (sem policy p/ authenticated = negado).
alter table public.plans enable row level security;

create policy plans_authenticated_read on public.plans
  for select to authenticated using (true);

-- 10. Verificação: plans agora tem RLS habilitado
-- (validado pelo 02-validation.sql seção 6)