-- 0043_authenticated_store_admin_destination.sql
-- Resolve the correct store-admin hostname for the authenticated user after login.
-- Prefer the current host when authorized; otherwise redirect only when the user
-- has exactly one active, verified store-admin destination.
create or replace function public.resolve_my_store_admin_destination(p_hostname text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with allowed as (
    select d.hostname
    from public.domains d
    join public.tenants t on t.id=d.tenant_id
    join public.stores s on s.id=d.store_id and s.tenant_id=d.tenant_id
    join public.store_members sm
      on sm.tenant_id=d.tenant_id
     and sm.store_id=d.store_id
     and sm.user_id=auth.uid()
    where d.type='store_admin'
      and d.status='active'
      and d.verified_at is not null
      and t.status in ('trial','active')
      and s.status='active'
  ),
  summary as (
    select
      max(hostname) filter (where hostname=lower(trim(trailing '.' from p_hostname))) as current_hostname,
      case when count(*)=1 then min(hostname) end as unique_hostname
    from allowed
  )
  select coalesce(current_hostname,unique_hostname) from summary;
$$;

revoke all on function public.resolve_my_store_admin_destination(text) from public;
grant execute on function public.resolve_my_store_admin_destination(text) to authenticated;
