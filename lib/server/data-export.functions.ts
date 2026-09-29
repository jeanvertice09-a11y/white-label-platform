import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { requireStoreRole } from "@white-label/auth";
import type { SqlExecutor } from "@white-label/domains";
import { createRealDeps, loadStoreAdmin } from "./route-context.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";

const ROW_LIMIT = 5_000;
const TOTAL_ROW_LIMIT = 20_000;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type ExportRow = Record<string, JsonValue>;
interface ExportDatasetDefinition {
  name: string;
  sql: string;
}

interface StoreDataExport {
  schemaVersion: number;
  generatedAt: string;
  scope: { tenantId: string; storeId: string };
  datasets: Record<string, ExportRow[]>;
  exclusions: string[];
}

const STORE_DATASETS: readonly ExportDatasetDefinition[] = [
  { name: "store", sql: `select to_jsonb(s)-'tenant_id' as data from public.stores s where tenant_id=$1::uuid and id=$2::uuid order by id limit $3` },
  { name: "categories", sql: `select to_jsonb(c)-'tenant_id'-'store_id' as data from public.categories c where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "products", sql: `select to_jsonb(p)-'tenant_id'-'store_id' as data from public.products p where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "product_variants", sql: `select to_jsonb(v)-'tenant_id'-'store_id' as data from public.product_variants v where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "customers", sql: `select to_jsonb(c)-'tenant_id'-'store_id' as data from public.customers c where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "orders", sql: `select to_jsonb(o)-'tenant_id'-'store_id' as data from public.orders o where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "order_items", sql: `select to_jsonb(i)-'tenant_id'-'store_id' as data from public.order_items i where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "coupons", sql: `select to_jsonb(c)-'tenant_id'-'store_id' as data from public.coupons c where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "financial_categories", sql: `select to_jsonb(c)-'tenant_id'-'store_id' as data from public.merchant_financial_categories c where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "financial_entries", sql: `select to_jsonb(e)-'tenant_id'-'store_id' as data from public.merchant_financial_entries e where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "suppliers", sql: `select to_jsonb(s)-'tenant_id'-'store_id' as data from public.merchant_suppliers s where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "purchases", sql: `select to_jsonb(p)-'tenant_id'-'store_id' as data from public.merchant_purchases p where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "purchase_items", sql: `select to_jsonb(i)-'tenant_id'-'store_id' as data from public.merchant_purchase_items i where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "tasks", sql: `select to_jsonb(t)-'tenant_id'-'store_id' as data from public.merchant_tasks t where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "campaigns", sql: `select to_jsonb(c)-'tenant_id'-'store_id' as data from public.marketing_campaigns c where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "marketing_consents", sql: `select to_jsonb(c)-'tenant_id'-'store_id' as data from public.marketing_consents c where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  { name: "catalog_settings", sql: `select to_jsonb(c)-'tenant_id'-'store_id' as data from public.catalog_settings c where tenant_id=$1::uuid and store_id=$2::uuid order by store_id limit $3` },
  { name: "store_banners", sql: `select to_jsonb(b)-'tenant_id'-'store_id' as data from public.store_banners b where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3` },
  {
    name: "audit_log",
    sql: `select jsonb_build_object(
      'id',id,'actor_user_id',actor_user_id,'action',action,'resource_type',resource_type,
      'resource_id',resource_id,'request_id',request_id,'created_at',created_at
    ) as data from public.audit_logs
    where tenant_id=$1::uuid and store_id=$2::uuid order by id limit $3`,
  },
];

function exportedRow(row: Record<string, unknown>): ExportRow {
  const value = row["data"];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Linha de exportação inválida");
  }
  return value as ExportRow;
}

async function loadDataset(
  sql: SqlExecutor,
  tenantId: string,
  storeId: string,
  definition: ExportDatasetDefinition,
): Promise<[string, ExportRow[]]> {
  const rows = await sql.query(definition.sql, [tenantId, storeId, ROW_LIMIT + 1]);
  if (rows.length > ROW_LIMIT) {
    throw new Error(
      `Exportação síncrona excede ${String(ROW_LIMIT)} registros em ${definition.name}; use job assíncrono antes de ampliar esse limite.`,
    );
  }
  return [definition.name, rows.map(exportedRow)];
}

async function exportContext(): Promise<{ tenantId: string; storeId: string; sql: SqlExecutor }> {
  const deps = await createRealDeps();
  const auth = await loadStoreAdmin({ host: getRequestHost() }, deps);
  if (!auth.storeId) throw new Error("Loja não resolvida");
  requireStoreRole({ storeRoles: auth.storeRoles }, "store_owner", "store_admin");
  return {
    tenantId: String(auth.tenantId),
    storeId: String(auth.storeId),
    sql: createAdminSqlExecutor(),
  };
}

async function buildCurrentStoreDataExport(): Promise<StoreDataExport> {
  const current = await exportContext();
  const entries: Array<[string, ExportRow[]]> = [];
  let totalRows = 0;
  for (const definition of STORE_DATASETS) {
    const entry = await loadDataset(
      current.sql,
      current.tenantId,
      current.storeId,
      definition,
    );
    totalRows += entry[1].length;
    if (totalRows > TOTAL_ROW_LIMIT) {
      throw new Error(
        `Exportação síncrona excede ${String(TOTAL_ROW_LIMIT)} registros no total; use job assíncrono para este volume.`,
      );
    }
    entries.push(entry);
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: { tenantId: current.tenantId, storeId: current.storeId },
    datasets: Object.fromEntries(entries),
    exclusions: [
      "service role e segredos de infraestrutura",
      "credenciais de gateways e material criptográfico",
      "hashes e tokens de autenticação",
      "IP, user-agent e metadata livre de audit logs",
      "dados de outros tenants/stores",
    ],
  };
}

export const getCurrentStoreDataExport = createServerFn({ method: "GET" }).handler(
  async () => buildCurrentStoreDataExport(),
);
