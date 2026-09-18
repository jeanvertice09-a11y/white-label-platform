-- 0011_console_read_policies.sql
-- Leituras do Master/Control pela sessão autenticada, sem conexão Postgres direta.
-- Escrita continua negada a authenticated; este arquivo libera somente SELECT via RLS.

create or replace function private.is_platform_admin()
returns boolean
language sql
security definer
set search_path = pg_catalog
stable
as $$
  select exists (
    select 1
    from public.platform_members m
    where m.user_id = auth.uid()
      and m.role in ('platform_owner', 'platform_admin')
  );
$$;

revoke all on function private.is_platform_admin() from public;
revoke all on function private.is_platform_admin() from anon;
grant execute on function private.is_platform_admin() to authenticated;

grant select on public.tenants, public.tenant_branding, public.tenant_settings,
  public.stores, public.store_members, public.domains, public.subscriptions,
  public.payments, public.plans, public.gateway_accounts, public.audit_logs
  to authenticated;

-- Master: platform_owner/platform_admin podem ler a visão administrativa global.
drop policy if exists tenants_platform_read on public.tenants;
create policy tenants_platform_read on public.tenants
  for select to authenticated using (private.is_platform_admin());

drop policy if exists stores_platform_read on public.stores;
create policy stores_platform_read on public.stores
  for select to authenticated using (private.is_platform_admin());

drop policy if exists tenant_branding_platform_read on public.tenant_branding;
create policy tenant_branding_platform_read on public.tenant_branding
  for select to authenticated using (private.is_platform_admin());

drop policy if exists tenant_settings_platform_read on public.tenant_settings;
create policy tenant_settings_platform_read on public.tenant_settings
  for select to authenticated using (private.is_platform_admin());

drop policy if exists store_members_platform_read on public.store_members;
create policy store_members_platform_read on public.store_members
  for select to authenticated using (private.is_platform_admin());

drop policy if exists domains_platform_read on public.domains;
create policy domains_platform_read on public.domains
  for select to authenticated using (private.is_platform_admin());

drop policy if exists subscriptions_platform_read on public.subscriptions;
create policy subscriptions_platform_read on public.subscriptions
  for select to authenticated using (private.is_platform_admin());

drop policy if exists payments_platform_read on public.payments;
create policy payments_platform_read on public.payments
  for select to authenticated using (private.is_platform_admin());

drop policy if exists gateways_platform_read on public.gateway_accounts;
create policy gateways_platform_read on public.gateway_accounts
  for select to authenticated using (private.is_platform_admin());

drop policy if exists audit_platform_read on public.audit_logs;
create policy audit_platform_read on public.audit_logs
  for select to authenticated using (private.is_platform_admin());

-- Control: membros do tenant leem somente dados da própria White Label.
drop policy if exists tenant_branding_member_read on public.tenant_branding;
create policy tenant_branding_member_read on public.tenant_branding
  for select to authenticated using (private.is_tenant_member(tenant_id));

drop policy if exists tenant_settings_member_read on public.tenant_settings;
create policy tenant_settings_member_read on public.tenant_settings
  for select to authenticated using (private.is_tenant_member(tenant_id));

drop policy if exists stores_tenant_member_read on public.stores;
create policy stores_tenant_member_read on public.stores
  for select to authenticated using (private.is_tenant_member(tenant_id));

drop policy if exists store_members_tenant_member_read on public.store_members;
create policy store_members_tenant_member_read on public.store_members
  for select to authenticated using (private.is_tenant_member(tenant_id));

drop policy if exists domains_tenant_member_read on public.domains;
create policy domains_tenant_member_read on public.domains
  for select to authenticated using (private.is_tenant_member(tenant_id));

drop policy if exists subscriptions_tenant_member_read on public.subscriptions;
create policy subscriptions_tenant_member_read on public.subscriptions
  for select to authenticated using (private.is_tenant_member(tenant_id));

drop policy if exists payments_tenant_member_read on public.payments;
create policy payments_tenant_member_read on public.payments
  for select to authenticated using (private.is_tenant_member(tenant_id));

drop policy if exists gateways_tenant_member_read on public.gateway_accounts;
create policy gateways_tenant_member_read on public.gateway_accounts
  for select to authenticated using (private.is_tenant_member(tenant_id));
