-- Resolve a store-admin hostname for the authenticated user without exposing domains.
-- SECURITY DEFINER is deliberately narrow: it returns only tenant/store ids after
-- proving the caller has an explicit store membership and all scopes are operational.
create or replace function public.resolve_my_store_admin_domain(p_hostname text)
returns table (tenant_id uuid, store_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.tenant_id, d.store_id
  from public.domains d
  join public.tenants t on t.id = d.tenant_id
  join public.stores s on s.id = d.store_id and s.tenant_id = d.tenant_id
  join public.store_members sm
    on sm.tenant_id = d.tenant_id
   and sm.store_id = d.store_id
   and sm.user_id = auth.uid()
  where d.hostname = lower(trim(trailing '.' from p_hostname))
    and d.type = 'store_admin'
    and d.status = 'active'
    and d.verified_at is not null
    and t.status in ('trial', 'active')
    and s.status = 'active'
  limit 1;
$$;

revoke all on function public.resolve_my_store_admin_domain(text) from public;
grant execute on function public.resolve_my_store_admin_domain(text) to authenticated;
