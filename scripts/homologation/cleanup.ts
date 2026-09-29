import { DEMO_TENANTS } from "./fixtures/data.ts";
import { quoteSql, stableUuid } from "./model.ts";

export const PLATFORM_GATEWAY_ID = stableUuid("gateway:platform");

export function buildHomologationCleanupSql(): string {
  const tenantIds = DEMO_TENANTS.map((tenant) => `${quoteSql(tenant.id)}::uuid`).join(",");
  const gateway = `${quoteSql(PLATFORM_GATEWAY_ID)}::uuid`;
  return `
begin;
delete from public.webhook_events
 where payment_id in (select id from public.payments where tenant_id in (${tenantIds}))
    or gateway_account_id=${gateway};
delete from public.payments where tenant_id in (${tenantIds});
delete from private.gateway_account_secrets where gateway_account_id=${gateway};
delete from public.gateway_accounts where id=${gateway} or tenant_id in (${tenantIds});
delete from public.audit_logs where tenant_id in (${tenantIds});
-- 0025 contains RESTRICT links across sibling branches of the tenant/store
-- cascade graph. Remove those rows explicitly in dependency order before the
-- tenant delete so PostgreSQL never has to resolve RESTRICT vs CASCADE order.
delete from public.merchant_financial_entries where tenant_id in (${tenantIds});
delete from public.merchant_purchase_items where tenant_id in (${tenantIds});
delete from public.merchant_purchases where tenant_id in (${tenantIds});
delete from public.merchant_tasks where tenant_id in (${tenantIds});
delete from public.merchant_suppliers where tenant_id in (${tenantIds});
delete from public.merchant_financial_categories where tenant_id in (${tenantIds});
delete from public.tenants where id in (${tenantIds});
commit;`;
}

export function buildCleanupStatements(): string {
  const sql = buildHomologationCleanupSql();
  return sql.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, "");
}