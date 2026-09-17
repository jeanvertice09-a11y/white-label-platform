-- 0005_membership_self_read.sql — leitura da PRÓPRIA membership.
-- Sem recursão: policies comparam coluna direta com auth.uid(),
-- sem subconsulta na mesma tabela. Servidor continua usando service_role;
-- clientes autenticados precisam ler as próprias memberships p/ UX (menus,
-- seleção de tenant/store). Nenhuma escrita liberada.
create policy tenant_members_self_read on public.tenant_members
  for select to authenticated using (user_id = auth.uid());

create policy store_members_self_read on public.store_members
  for select to authenticated using (user_id = auth.uid());

create policy platform_members_self_read on public.platform_members
  for select to authenticated using (user_id = auth.uid());
