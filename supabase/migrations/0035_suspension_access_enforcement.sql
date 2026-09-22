-- 0035_suspension_access_enforcement.sql — suspended tenant/store fail-closed at DB membership boundaries.

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tenant_members m
    join public.tenants t on t.id=m.tenant_id
    where m.tenant_id=p_tenant_id and m.user_id=auth.uid()
      and t.status in ('trial','active')
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
    join public.stores s on s.tenant_id=m.tenant_id and s.id=m.store_id
    join public.tenants t on t.id=s.tenant_id
    where m.store_id=p_store_id and m.user_id=auth.uid()
      and s.status='active' and t.status in ('trial','active')
  );
$$;

revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.is_store_member(uuid) from public;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.is_store_member(uuid) to authenticated;

drop policy if exists tenant_members_self_read on public.tenant_members;
create policy tenant_members_self_read on public.tenant_members
  for select to authenticated using (
    user_id=(select auth.uid())
    and exists(select 1 from public.tenants t where t.id=tenant_id and t.status in ('trial','active'))
  );

drop policy if exists store_members_self_read on public.store_members;
create policy store_members_self_read on public.store_members
  for select to authenticated using (
    user_id=(select auth.uid())
    and exists(
      select 1 from public.stores s join public.tenants t on t.id=s.tenant_id
      where s.tenant_id=store_members.tenant_id and s.id=store_members.store_id
        and s.status='active' and t.status in ('trial','active')
    )
  );
