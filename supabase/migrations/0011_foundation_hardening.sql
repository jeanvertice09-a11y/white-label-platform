-- 0011_foundation_hardening.sql — segurança e índices da fundação crítica.
-- Não altera regras de acesso das tabelas deny-by-default.

-- ---------- SUPABASE MANAGED RLS EVENT TRIGGER ----------
-- O Supabase cria public.rls_auto_enable() como SECURITY DEFINER para o
-- event trigger ensure_rls. O event trigger continua funcionando como owner;
-- usuários da Data API não precisam (nem devem) chamar a função diretamente.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'alter function public.rls_auto_enable() set search_path = pg_catalog';
    execute 'revoke execute on function public.rls_auto_enable() from public';
    execute 'revoke execute on function public.rls_auto_enable() from anon';
    execute 'revoke execute on function public.rls_auto_enable() from authenticated';
  end if;
end;
$$;

-- ---------- MEMBERSHIP SELF-READ ----------
-- auth.uid() em subselect vira initplan por statement, evitando reavaliação
-- por linha sem mudar a regra: cada usuário enxerga somente a própria membership.
drop policy if exists tenant_members_self_read on public.tenant_members;
create policy tenant_members_self_read on public.tenant_members
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists store_members_self_read on public.store_members;
create policy store_members_self_read on public.store_members
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists platform_members_self_read on public.platform_members;
create policy platform_members_self_read on public.platform_members
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------- ÍNDICES DE RELAÇÕES/CONSULTAS ATIVAS ----------
-- Domains: administração por tenant/store. Lookup de hostname ativo já usa
-- domains_hostname_active_uidx.
create index if not exists domains_tenant_store_idx
  on public.domains (tenant_id, store_id);

-- Hierarquia de categorias e filtro de produtos por categoria.
create index if not exists categories_parent_scope_idx
  on public.categories (tenant_id, store_id, parent_id);
create index if not exists products_category_scope_idx
  on public.products (tenant_id, store_id, category_id);

-- Assets e imagens são sempre consultados/validados no escopo tenant/store.
create index if not exists media_assets_scope_idx
  on public.media_assets (tenant_id, store_id);
create index if not exists product_images_variant_scope_idx
  on public.product_images (tenant_id, store_id, product_id, variant_id);

-- Um único índice cobre as FKs de product e variant dos itens.
create index if not exists order_items_product_variant_scope_idx
  on public.order_items (tenant_id, store_id, product_id, variant_id);

-- Listagem operacional de pedidos não filtra status; cupom é FK composta.
create index if not exists orders_store_created_idx
  on public.orders (tenant_id, store_id, created_at desc);
create index if not exists orders_coupon_scope_idx
  on public.orders (tenant_id, store_id, coupon_id)
  where coupon_id is not null;

-- Assinaturas são carregadas por tenant e relacionadas ao plano.
create index if not exists subscriptions_tenant_created_idx
  on public.subscriptions (tenant_id, created_at desc);
create index if not exists subscriptions_plan_idx
  on public.subscriptions (plan_id);

-- Payments possui três FKs distintas para gateway e consultas por tenant/data.
create index if not exists payments_gateway_account_idx
  on public.payments (gateway_account_id);
create index if not exists payments_level_gateway_idx
  on public.payments (level, gateway_account_id);
create index if not exists payments_scope_gateway_idx
  on public.payments (tenant_id, store_id, gateway_account_id);
create index if not exists payments_tenant_created_idx
  on public.payments (tenant_id, created_at desc);

-- Webhooks precisam localizar eventos filhos quando um gateway é alterado/removido.
create index if not exists webhook_events_gateway_account_idx
  on public.webhook_events (gateway_account_id);

-- Intencionalmente NÃO criamos policies para tabelas operacionais que já são
-- deny-by-default. Admin/catalog/checkout continuam atravessando boundaries
-- server-side após autorização/hostname confiável.
