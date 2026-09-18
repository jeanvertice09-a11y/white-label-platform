-- 0015_master_white_label_management.sql
-- Invariantes para gestão segura de White Labels pelo Master.
-- Não cria nova arquitetura comercial nem altera migrations anteriores.

create unique index tenant_members_single_owner_uidx
  on public.tenant_members (tenant_id)
  where role = 'tenant_owner';

drop index if exists public.domains_hostname_active_uidx;
create unique index domains_hostname_uidx on public.domains (hostname);
