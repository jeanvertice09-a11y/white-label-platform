-- 0029_tenant_owner_serialization.sql
-- Serializa mutações de tenant_owner por tenant para preservar o invariant
-- de pelo menos um owner mesmo sob requisições concorrentes.
-- Esta migration é versionada pelo código; não deve ser aplicada manualmente
-- fora do fluxo oficial de migrations.

create or replace function public.control_upsert_tenant_member_guarded(
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_role text,
  p_actor_user_id uuid,
  p_actor_is_owner boolean
)
returns table(user_id uuid, role text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_current_role text;
  v_owner_count integer;
begin
  if p_role not in ('tenant_owner','tenant_admin','tenant_finance','tenant_support') then
    raise exception 'Role de White Label inválida.';
  end if;

  perform 1 from public.tenants where id=p_tenant_id for update;
  if not found then raise exception 'White Label não encontrada.'; end if;

  select tm.role into v_actor_role
  from public.tenant_members tm
  where tm.tenant_id=p_tenant_id and tm.user_id=p_actor_user_id;

  if v_actor_role not in ('tenant_owner','tenant_admin') then
    raise exception 'Gestão de equipe requer tenant_owner/admin.';
  end if;
  if p_actor_is_owner is distinct from (v_actor_role='tenant_owner') then
    raise exception 'Membership do ator mudou; atualize a sessão e tente novamente.';
  end if;

  select tm.role into v_current_role
  from public.tenant_members tm
  where tm.tenant_id=p_tenant_id and tm.user_id=p_target_user_id;

  if p_role='tenant_owner' and v_actor_role<>'tenant_owner' then
    raise exception 'Somente tenant_owner pode administrar outro tenant_owner.';
  end if;
  if v_current_role='tenant_owner' and v_actor_role<>'tenant_owner' then
    raise exception 'Somente tenant_owner pode administrar outro tenant_owner.';
  end if;
  if v_current_role='tenant_owner' and p_role<>'tenant_owner' then
    select count(*)::integer into v_owner_count
    from public.tenant_members
    where tenant_id=p_tenant_id and role='tenant_owner';
    if v_owner_count <= 1 then
      raise exception 'A White Label precisa manter pelo menos um tenant_owner.';
    end if;
  end if;

  insert into public.tenant_members(tenant_id,user_id,role)
  values (p_tenant_id,p_target_user_id,p_role)
  on conflict (tenant_id,user_id) do update set role=excluded.role;

  insert into public.audit_logs(
    actor_user_id,tenant_id,action,resource_type,resource_id,metadata
  ) values (
    p_actor_user_id,p_tenant_id,'control.team.tenant_member_saved','tenant_member',
    p_target_user_id::text,jsonb_build_object('role',p_role)
  );

  return query select p_target_user_id,p_role;
end;
$$;

create or replace function public.control_remove_tenant_member_guarded(
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_actor_user_id uuid,
  p_actor_is_owner boolean
)
returns table(user_id uuid, role text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_target_role text;
  v_owner_count integer;
begin
  perform 1 from public.tenants where id=p_tenant_id for update;
  if not found then raise exception 'White Label não encontrada.'; end if;

  select tm.role into v_actor_role
  from public.tenant_members tm
  where tm.tenant_id=p_tenant_id and tm.user_id=p_actor_user_id;

  if v_actor_role not in ('tenant_owner','tenant_admin') then
    raise exception 'Gestão de equipe requer tenant_owner/admin.';
  end if;
  if p_actor_is_owner is distinct from (v_actor_role='tenant_owner') then
    raise exception 'Membership do ator mudou; atualize a sessão e tente novamente.';
  end if;

  select tm.role into v_target_role
  from public.tenant_members tm
  where tm.tenant_id=p_tenant_id and tm.user_id=p_target_user_id;

  if v_target_role is null then raise exception 'Membership não encontrada nesta White Label.'; end if;
  if v_target_role='tenant_owner' and v_actor_role<>'tenant_owner' then
    raise exception 'Somente tenant_owner pode administrar outro tenant_owner.';
  end if;
  if v_target_role='tenant_owner' then
    select count(*)::integer into v_owner_count
    from public.tenant_members
    where tenant_id=p_tenant_id and role='tenant_owner';
    if v_owner_count <= 1 then
      raise exception 'A White Label precisa manter pelo menos um tenant_owner.';
    end if;
  end if;

  delete from public.tenant_members
  where tenant_id=p_tenant_id and user_id=p_target_user_id;

  insert into public.audit_logs(
    actor_user_id,tenant_id,action,resource_type,resource_id,metadata
  ) values (
    p_actor_user_id,p_tenant_id,'control.team.tenant_member_removed','tenant_member',
    p_target_user_id::text,jsonb_build_object('role',v_target_role)
  );

  return query select p_target_user_id,v_target_role;
end;
$$;

revoke all on function public.control_upsert_tenant_member_guarded(uuid,uuid,text,uuid,boolean) from public;
revoke all on function public.control_upsert_tenant_member_guarded(uuid,uuid,text,uuid,boolean) from anon;
revoke all on function public.control_upsert_tenant_member_guarded(uuid,uuid,text,uuid,boolean) from authenticated;
grant execute on function public.control_upsert_tenant_member_guarded(uuid,uuid,text,uuid,boolean) to service_role;

revoke all on function public.control_remove_tenant_member_guarded(uuid,uuid,uuid,boolean) from public;
revoke all on function public.control_remove_tenant_member_guarded(uuid,uuid,uuid,boolean) from anon;
revoke all on function public.control_remove_tenant_member_guarded(uuid,uuid,uuid,boolean) from authenticated;
grant execute on function public.control_remove_tenant_member_guarded(uuid,uuid,uuid,boolean) to service_role;
