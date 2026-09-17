-- ============================================================
-- VALIDAÇÃO SEGURA — white-label-platform
-- Executar APÓS aplicar 01-schema.sql (migrations 0001-0005 + 0006)
-- Apenas SELECTs — NENHUM INSERT/UPDATE/DELETE/DDL
-- Schema real: 21 tabelas públicas
-- ============================================================

-- ============================================================
-- 1. TABELAS ESPERADAS EXISTEM (21 tabelas)
-- ============================================================
select
  'tabelas_esperadas' as check_name,
  string_agg(table_name, ', ' order by table_name) as tables_found,
  case when count(*) = 21 then 'PASS' else 'FAIL' end as result
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'tenants','tenant_members','platform_members','tenant_branding','tenant_settings',
    'stores','store_members','store_settings',
    'domains','audit_logs',
    'categories','products','orders','order_items','stock_movements','media_assets',
    'plans','subscriptions','gateway_accounts','payments','webhook_events'
  );

-- ============================================================
-- 2. PRIMARY KEYS EXISTEM (21 tabelas = 21 PKs distintas)
-- ============================================================
select
  'primary_keys' as check_name,
  string_agg(distinct tc.table_name, ', ' order by tc.table_name) as tables_with_pk,
  case when count(distinct tc.table_name) = 21 then 'PASS' else 'FAIL' end as result
from information_schema.table_constraints tc
where tc.constraint_type = 'PRIMARY KEY'
  and tc.table_schema = 'public'
  and tc.table_name in (
    'tenants','tenant_members','platform_members','tenant_branding','tenant_settings',
    'stores','store_members','store_settings',
    'domains','audit_logs',
    'categories','products','orders','order_items','stock_movements','media_assets',
    'plans','subscriptions','gateway_accounts','payments','webhook_events'
  );

-- ============================================================
-- 3. FOREIGN KEYS COMPOSTAS PRINCIPAIS EXISTEM (14 FKs nomeadas)
-- ============================================================
select
  'fk_compostas_principais' as check_name,
  string_agg(tc.constraint_name, ', ' order by tc.constraint_name) as fks_found,
  case when count(*) = 14 then 'PASS' else 'FAIL' end as result
from information_schema.table_constraints tc
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.constraint_name in (
    'stores_tenant_id_fkey',
    'store_members_tenant_id_store_id_fkey',
    'store_settings_tenant_id_store_id_fkey',
    'domains_tenant_id_store_id_fkey',
    'categories_tenant_id_store_id_fkey',
    'products_tenant_id_store_id_fkey',
    'orders_tenant_id_store_id_fkey',
    'order_items_tenant_id_store_id_fkey',
    'stock_movements_tenant_id_store_id_fkey',
    'audit_logs_store_fk',
    'media_assets_store_fk',
    'gateway_accounts_store_fk',
    'payments_gateway_level_fk',
    'payments_gateway_store_fk'
  );

-- ============================================================
-- 4. UNIQUE COMPOSTAS CRÍTICAS EXISTEM (8 constraints UNIQUE)
-- ============================================================
select
  'unique_compostas_criticas' as check_name,
  string_agg(tc.constraint_name, ', ' order by tc.constraint_name) as uniques_found,
  case when count(*) = 8 then 'PASS' else 'FAIL' end as result
from information_schema.table_constraints tc
where tc.constraint_type = 'UNIQUE'
  and tc.table_schema = 'public'
  and tc.constraint_name in (
    'stores_tenant_id_id_key',
    'stores_tenant_id_slug_key',
    'categories_tenant_store_id_uidx',
    'products_tenant_store_id_uidx',
    'orders_tenant_store_id_uidx',
    'gateway_accounts_level_id_uidx',
    'gateway_accounts_tenant_store_id_uidx',
    'webhook_events_provider_gateway_account_id_external_event_id_key'
  );

-- Nota: tenants_slug_uidx e domains_hostname_active_uidx são INDEXES, não constraints UNIQUE
-- Verificados no teste de índices (seção 10).

-- ============================================================
-- 5. CHECK CONSTRAINTS DE ESCOPO EXISTEM (7 checks nomeados)
-- ============================================================
select
  'check_constraints_escopo' as check_name,
  string_agg(tc.constraint_name, ', ' order by tc.constraint_name) as checks_found,
  case when count(*) = 7 then 'PASS' else 'FAIL' end as result
from information_schema.table_constraints tc
where tc.constraint_type = 'CHECK'
  and tc.table_schema = 'public'
  and tc.constraint_name in (
    'domains_scope_ck',
    'domains_hostname_ck',
    'domains_verified_ck',
    'audit_logs_scope_ck',
    'gateway_accounts_scope_ck',
    'payments_scope_ck',
    'subscriptions_level_check'
  );

-- ============================================================
-- 6. RLS HABILITADO EM TODAS AS 21 TABELAS DE NEGÓCIO
-- ============================================================
select
  'rls_habilitado' as check_name,
  string_agg(c.relname, ', ' order by c.relname) as tables_with_rls,
  case when count(*) = 21 then 'PASS' else 'FAIL' end as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = true
  and c.relname in (
    'tenants','tenant_members','platform_members','tenant_branding','tenant_settings',
    'stores','store_members','store_settings',
    'domains','audit_logs',
    'categories','products','orders','order_items','stock_movements','media_assets',
    'plans','subscriptions','gateway_accounts','payments','webhook_events'
  );

-- ============================================================
-- 7. POLICIES ESPERADAS EXISTEM (7 policies)
-- ============================================================
select
  'policies_esperadas' as check_name,
  string_agg(policyname, ', ' order by policyname) as policies_found,
  case when count(*) = 7 then 'PASS' else 'FAIL' end as result
from pg_policies
where schemaname = 'public'
  and policyname in (
    'tenants_member_read',
    'stores_member_read',
    'products_member_read',
    'orders_member_read',
    'tenant_members_self_read',
    'store_members_self_read',
    'platform_members_self_read'
  );

-- ============================================================
-- 8. FUNÇÕES HELPER EXISTEM E TÊM PROTEÇÕES CORRETAS
-- ============================================================
-- 8a. Funções existem NO SCHEMA PRIVATE (2)
select
  'funcoes_helpers_private' as check_name,
  string_agg(p.proname, ', ' order by p.proname) as functions_found,
  case when count(*) = 2 then 'PASS' else 'FAIL' end as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in ('is_tenant_member', 'is_store_member');

-- 8b. São SECURITY DEFINER
select
  'funcoes_security_definer' as check_name,
  string_agg(p.proname || ': secdef=' || p.prosecdef::text, '; ') as function_props,
  case when sum(case when p.prosecdef then 1 else 0 end) = 2 then 'PASS' else 'FAIL' end as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in ('is_tenant_member', 'is_store_member');

-- 8c. Apenas authenticated tem EXECUTE (anon NÃO deve ter) — usando pg_roles para resolver OID
select
  'funcoes_grants' as check_name,
  string_agg(r.rolname || '->' || acl.privilege_type, ', ') as grants,
  case
    when bool_and(r.rolname = 'authenticated' and acl.privilege_type = 'EXECUTE')
         and count(*) = 2 then 'PASS'
    else 'FAIL'
  end as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join lateral aclexplode(p.proacl) as acl on true
join pg_roles r on r.oid = acl.grantee
where n.nspname = 'private'
  and p.proname in ('is_tenant_member', 'is_store_member')
  and r.rolname not in ('postgres', 'PUBLIC');

-- 8d. Verificação explícita: anon NÃO tem EXECUTE
select
  'anon_sem_execute_helpers' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join lateral aclexplode(p.proacl) as acl on true
join pg_roles r on r.oid = acl.grantee
where n.nspname = 'private'
  and p.proname in ('is_tenant_member', 'is_store_member')
  and r.rolname = 'anon';

-- 8e. Garantir que funções antigas em public NÃO existem mais
select
  'helpers_removidos_de_public' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_tenant_member', 'is_store_member');

-- ============================================================
-- 9. TRIGGER DE PAYMENTS EXISTE
-- ============================================================
select
  'trigger_payments' as check_name,
  tgname as trigger_name,
  case when tgname = 'payments_gateway_scope_trg' then 'PASS' else 'FAIL' end as result
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'payments'
  and t.tgname = 'payments_gateway_scope_trg';

-- ============================================================
-- 10. ÍNDICES CRÍTICOS EXISTEM (8 índices)
-- ============================================================
select
  'indices_criticos' as check_name,
  string_agg(indexname, ', ' order by indexname) as indexes_found,
  case when count(*) = 8 then 'PASS' else 'FAIL' end as result
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'tenants_slug_uidx',
    'tenant_members_user_idx',
    'store_members_user_idx',
    'store_members_tenant_idx',
    'domains_hostname_active_uidx',
    'audit_logs_tenant_idx',
    'audit_logs_store_idx',
    'products_store_idx'
  );

-- ============================================================
-- 11. COLUNAS CRÍTICAS TÊM TIPOS CORRETOS (12 colunas)
-- ============================================================
select
  'colunas_criticas_tipos' as check_name,
  string_agg(table_name || '.' || column_name || ':' || data_type, ', ' order by table_name, column_name) as columns,
  case when count(*) = 12 then 'PASS' else 'FAIL' end as result
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name, data_type) in (
    ('tenants', 'id', 'uuid'),
    ('tenants', 'slug', 'text'),
    ('stores', 'id', 'uuid'),
    ('stores', 'tenant_id', 'uuid'),
    ('store_members', 'tenant_id', 'uuid'),
    ('store_members', 'store_id', 'uuid'),
    ('domains', 'tenant_id', 'uuid'),
    ('domains', 'store_id', 'uuid'),
    ('products', 'tenant_id', 'uuid'),
    ('products', 'store_id', 'uuid'),
    ('orders', 'tenant_id', 'uuid'),
    ('orders', 'store_id', 'uuid')
  );

-- ============================================================
-- 12. ENUMS / CHECKS DE STATUS/ROLE/LEVEL/TYPE EXISTEM (>= 20)
-- ============================================================
select
  'enums_checks_valores' as check_name,
  string_agg(tc.table_name || '.' || tc.constraint_name || ':' || cc.check_clause, '; ') as constraints,
  case when count(*) >= 20 then 'PASS' else 'FAIL' end as result
from information_schema.table_constraints tc
join information_schema.check_constraints cc on tc.constraint_name = cc.constraint_name
where tc.constraint_type = 'CHECK'
  and tc.table_schema = 'public'
  and tc.table_name in ('tenants','tenant_members','platform_members','stores','store_members','domains','products','subscriptions','gateway_accounts','payments');

-- ============================================================
-- 13. SCHEMA PRIVATE EXISTE E TEM USAGE CORRETO
-- ============================================================
select
  'schema_private' as check_name,
  n.nspname as schema_name,
  case when n.nspname = 'private' then 'PASS' else 'FAIL' end as result
from pg_namespace n
where n.nspname = 'private';

-- 13b. Grants no schema private: apenas authenticated tem USAGE
select
  'schema_private_grants' as check_name,
  string_agg(r.rolname || '->' || acl.privilege_type, ', ') as grants,
  case
    when bool_and(r.rolname = 'authenticated' and acl.privilege_type = 'USAGE')
         and count(*) = 1 then 'PASS'
    else 'FAIL'
  end as result
from pg_namespace n
join lateral aclexplode(n.nspacl) as acl on true
join pg_roles r on r.oid = acl.grantee
where n.nspname = 'private'
  and r.rolname not in ('postgres', 'PUBLIC');

-- ============================================================
-- RESUMO FINAL
-- ============================================================
select '=== RESUMO DE VALIDAÇÃO ===' as summary;
select 'Execute cada query acima. Todas devem retornar PASS.' as instruction;
select 'Se alguma retornar FAIL, verifique o schema aplicado vs migrations originais.' as note;