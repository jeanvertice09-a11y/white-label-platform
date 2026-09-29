-- 0044_membership_self_read_operational_scope.sql
-- Fix authenticated membership reads without weakening tenant/store isolation.
-- The previous policies joined stores/tenants directly; those tables are deny-by-default
-- to authenticated users, so the policy's EXISTS was always false in production.
-- Reuse the narrow SECURITY DEFINER membership helpers that already enforce operational status.
-- These helpers are intentionally callable by authenticated users; they return only booleans
-- scoped to auth.uid() and do not expose tenant/store rows.
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.is_store_member(uuid) to authenticated;

drop policy if exists tenant_members_self_read on public.tenant_members;
create policy tenant_members_self_read on public.tenant_members
  for select to authenticated using (
    user_id = (select auth.uid())
    and public.is_tenant_member(tenant_id)
  );

drop policy if exists store_members_self_read on public.store_members;
create policy store_members_self_read on public.store_members
  for select to authenticated using (
    user_id = (select auth.uid())
    and public.is_store_member(store_id)
  );

revoke execute on function public.resolve_my_store_admin_domain(text) from anon;
revoke execute on function public.resolve_my_store_admin_destination(text) from anon;
