import { buildHomologationCleanupSql, buildCleanupStatements } from "./cleanup.ts";
import { DEMO_COUNTS, DEMO_TENANTS } from "./fixtures/data.ts";
import { buildBillingSql } from "./fixtures/billing-sql.ts";
import { buildCatalogSql } from "./fixtures/catalog-sql.ts";
import { buildCustomersOrdersStockSql } from "./fixtures/customers-orders-sql.ts";
import { buildFoundationSql } from "./fixtures/foundation-sql.ts";
import { buildMarketingSql } from "./fixtures/marketing-sql.ts";
import { buildOperationsSql } from "./fixtures/operations-sql.ts";
import type { HomologationRuntimeConfig, SqlExecutor } from "./model.ts";
import { quoteSql } from "./model.ts";
import { runHomologationPreflight } from "./preflight.ts";

export interface HomologationSqlExecutor extends SqlExecutor {
  execScript(sql: string): Promise<void>;
}

function integrityAssertionsSql(): string {
  const tenantIds = DEMO_TENANTS.map((tenant) => `${quoteSql(tenant.id)}::uuid`).join(",");
  return `
do $$
declare
  tenant_count integer;
  store_count integer;
  product_count integer;
  order_count integer;
  stock_mismatch integer;
  purchase_mismatch integer;
begin
  select count(*)::integer into tenant_count from public.tenants where id in (${tenantIds});
  select count(*)::integer into store_count from public.stores where tenant_id in (${tenantIds});
  select count(*)::integer into product_count from public.products where tenant_id in (${tenantIds});
  select count(*)::integer into order_count from public.orders where tenant_id in (${tenantIds});
  if tenant_count <> ${DEMO_COUNTS.tenants} or store_count <> ${DEMO_COUNTS.stores}
    or product_count <> ${DEMO_COUNTS.products} or order_count <> ${DEMO_COUNTS.orders} then
    raise exception 'homologation seed: contagens centrais divergentes';
  end if;

  select count(*)::integer into stock_mismatch from (
    select v.id from public.product_variants v
    where v.tenant_id in (${tenantIds})
      and v.stock_quantity <> coalesce((select sum(sm.delta)::integer from public.stock_movements sm where sm.tenant_id=v.tenant_id and sm.store_id=v.store_id and sm.product_id=v.product_id and sm.variant_id=v.id),0)
    union all
    select p.id from public.products p
    where p.tenant_id in (${tenantIds})
      and not exists(select 1 from public.product_variants v where v.tenant_id=p.tenant_id and v.store_id=p.store_id and v.product_id=p.id)
      and p.stock_quantity <> coalesce((select sum(sm.delta)::integer from public.stock_movements sm where sm.tenant_id=p.tenant_id and sm.store_id=p.store_id and sm.product_id=p.id and sm.variant_id is null),0)
  ) mismatches;
  if stock_mismatch <> 0 then raise exception 'homologation seed: ledger de estoque não reconcilia'; end if;

  select count(*)::integer into purchase_mismatch
  from public.merchant_purchases p
  where p.tenant_id in (${tenantIds})
    and p.subtotal_cents <> coalesce((select sum(i.subtotal_cents) from public.merchant_purchase_items i where i.tenant_id=p.tenant_id and i.store_id=p.store_id and i.purchase_id=p.id),0);
  if purchase_mismatch <> 0 then raise exception 'homologation seed: compras não reconciliam itens'; end if;
end $$;`;
}

async function executeTransactional(sql: HomologationSqlExecutor, body: string): Promise<void> {
  try {
    await sql.execScript(`begin;\n${body}\ncommit;`);
  } catch (error) {
    try { await sql.execScript("rollback;"); } catch { /* conexão pode já ter revertido */ }
    throw error;
  }
}

export async function applyHomologationSeed(
  sql: HomologationSqlExecutor,
  config: HomologationRuntimeConfig,
): Promise<void> {
  const preflight = await runHomologationPreflight(sql, config);
  const body = [
    buildCleanupStatements(),
    buildFoundationSql(config),
    buildCatalogSql(config),
    buildCustomersOrdersStockSql(config.anchorIso),
    buildMarketingSql(config.anchorIso),
    buildOperationsSql(config),
    buildBillingSql(preflight, config),
    integrityAssertionsSql(),
  ].join("\n");
  await executeTransactional(sql, body);
}

export async function cleanupHomologationSeed(sql: HomologationSqlExecutor): Promise<void> {
  const script = buildHomologationCleanupSql();
  try {
    await sql.execScript(script);
  } catch (error) {
    try { await sql.execScript("rollback;"); } catch { /* conexão pode já ter revertido */ }
    throw error;
  }
}
