import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Category } from "@white-label/catalog";
import {
  MAX_IMPORT_ROWS,
  type NormalizedImportProduct,
  type RawImportRow,
  validateImportRows,
} from "../bulk-import.ts";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import {
  assertProductMutationEntitlements,
  assertVariantMutationEntitlements,
} from "./catalog-entitlements.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";

const rowSchema = z.object({
  line: z.number().int().min(2).max(MAX_IMPORT_ROWS + 1),
  values: z.record(z.string().max(80), z.string().max(50_000)),
});
const importSchema = z.object({ rows: z.array(rowSchema).min(1).max(MAX_IMPORT_ROWS) });
type Sql = ReturnType<typeof createAdminSqlExecutor>;

function textList(rows: Record<string, unknown>[], key: string): string[] {
  return rows.flatMap((row) => typeof row[key] === "string" ? [row[key]] : []);
}

async function loadValidationData(sql: Sql, tenantId: string, storeId: string, categories: Category[], rows: RawImportRow[]) {
  const [productRows, variantRows] = await Promise.all([
    sql.query(`select sku,slug from public.products where tenant_id=$1::uuid and store_id=$2::uuid`, [tenantId, storeId]),
    sql.query(`select sku from public.product_variants where tenant_id=$1::uuid and store_id=$2::uuid and sku is not null`, [tenantId, storeId]),
  ]);
  return validateImportRows(rows, categories, [...textList(productRows, "sku"), ...textList(variantRows, "sku")], textList(productRows, "slug"));
}

async function prepareImport(rows: RawImportRow[]) {
  const context = await createMerchantCatalogContext(getRequestHost());
  const userId = context.userId;
  if (!userId) throw new Error("Usuário autenticado não resolvido");
  const sql = createAdminSqlExecutor();
  await assertProductMutationEntitlements(sql, context.scope, "create", rows.length);
  const categories = await context.repository.listCategories(context.scope, false);
  const result = await loadValidationData(sql, context.scope.tenantId, context.scope.storeId, categories, rows);
  if (result.products.some((product) => product.variants.length > 0)) await assertVariantMutationEntitlements(sql, context.scope);
  return { context, userId, sql, result };
}

function previewProduct(product: NormalizedImportProduct) {
  return {
    line: product.line, name: product.name, sku: product.sku, category: product.categoryLabel,
    priceCents: product.priceCents, stockQuantity: product.stockQuantity,
    variantCount: product.variants.length, active: product.active,
  };
}

export const validateMerchantProductImport = createServerFn({ method: "POST" })
  .validator(importSchema)
  .handler(async ({ data }) => {
    const prepared = await prepareImport(data.rows);
    return {
      totalRows: prepared.result.totalRows,
      totalValid: prepared.result.totalValid,
      totalInvalid: prepared.result.totalInvalid,
      issues: prepared.result.issues,
      preview: prepared.result.products.map(previewProduct),
    };
  });

function importPayload(products: NormalizedImportProduct[]) {
  return products.map((product) => ({
    row_no: product.line, name: product.name, slug: product.slug, description: product.description, sku: product.sku,
    category_id: product.categoryId, price_cents: product.priceCents, compare_at_price_cents: product.compareAtPriceCents,
    cost_cents: product.costCents, active: product.active, track_inventory: product.trackInventory,
    stock_quantity: product.stockQuantity, position: product.position,
    variants: product.variants.map((variant) => ({
      name: variant.name, sku: variant.sku, attributes: variant.attributes, price_cents: variant.priceCents,
      compare_at_price_cents: variant.compareAtPriceCents, cost_cents: variant.costCents, active: variant.active,
      stock_quantity: variant.stockQuantity, position: variant.position,
    })),
  }));
}

const ATOMIC_IMPORT_SQL = `with payload as (
  select * from jsonb_to_recordset($4::jsonb) as p(
    row_no integer,name text,slug text,description text,sku text,category_id uuid,
    price_cents bigint,compare_at_price_cents bigint,cost_cents bigint,active boolean,
    track_inventory boolean,stock_quantity integer,position integer,variants jsonb
  )
), inserted_products as (
  insert into public.products (
    tenant_id,store_id,name,slug,description,sku,category_id,price_cents,
    compare_at_price_cents,cost_cents,active,track_inventory,stock_quantity,position,updated_at
  )
  select $1::uuid,$2::uuid,p.name,p.slug,p.description,p.sku,p.category_id,p.price_cents,
    p.compare_at_price_cents,p.cost_cents,p.active,p.track_inventory,p.stock_quantity,p.position,now()
  from payload p
  returning id,slug,sku,track_inventory,stock_quantity
), variant_payload as (
  select ip.id as product_id,p.slug,v.*
  from payload p
  join inserted_products ip on ip.slug=p.slug
  cross join lateral jsonb_to_recordset(coalesce(p.variants,'[]'::jsonb)) as v(
    name text,sku text,attributes jsonb,price_cents bigint,compare_at_price_cents bigint,
    cost_cents bigint,active boolean,stock_quantity integer,position integer
  )
), inserted_variants as (
  insert into public.product_variants (
    tenant_id,store_id,product_id,name,sku,attributes,price_cents,compare_at_price_cents,
    cost_cents,active,stock_quantity,position,updated_at
  )
  select $1::uuid,$2::uuid,v.product_id,v.name,v.sku,coalesce(v.attributes,'{}'::jsonb),v.price_cents,
    v.compare_at_price_cents,v.cost_cents,v.active,v.stock_quantity,v.position,now()
  from variant_payload v
  returning id,product_id,stock_quantity
), product_stock as (
  insert into public.stock_movements (tenant_id,store_id,product_id,variant_id,delta,reason,movement_type,created_by)
  select $1::uuid,$2::uuid,p.id,null::uuid,p.stock_quantity,'Saldo inicial da importação em massa','initial',$3::uuid
  from inserted_products p
  where p.track_inventory=true and p.stock_quantity<>0
    and not exists (select 1 from inserted_variants v where v.product_id=p.id)
  returning id
), variant_stock as (
  insert into public.stock_movements (tenant_id,store_id,product_id,variant_id,delta,reason,movement_type,created_by)
  select $1::uuid,$2::uuid,v.product_id,v.id,v.stock_quantity,'Saldo inicial da importação em massa','initial',$3::uuid
  from inserted_variants v
  join inserted_products p on p.id=v.product_id and p.track_inventory=true
  where v.stock_quantity<>0
  returning id
), audit as (
  insert into public.audit_logs (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
  values ($3::uuid,$1::uuid,$2::uuid,'products.bulk_imported','store',$2::text,
    jsonb_build_object('products',(select count(*) from inserted_products),'variants',(select count(*) from inserted_variants),
    'initial_stock_movements',(select count(*) from product_stock)+(select count(*) from variant_stock)))
  returning id
)
select (select count(*)::integer from inserted_products) as products,
  (select count(*)::integer from inserted_variants) as variants,
  ((select count(*) from product_stock)+(select count(*) from variant_stock))::integer as stock_movements`;

async function executeAtomicImport(sql: Sql, tenantId: string, storeId: string, userId: string, products: NormalizedImportProduct[]) {
  const rows = await sql.query(ATOMIC_IMPORT_SQL, [tenantId, storeId, userId, JSON.stringify(importPayload(products))]);
  if (rows.length === 0) throw new Error("Importação não retornou resultado");
  const row = rows[0];
  return { products: Number(row["products"] ?? 0), variants: Number(row["variants"] ?? 0), stockMovements: Number(row["stock_movements"] ?? 0) };
}

function validationFailureDetail(issues: readonly { line: number | null; field: string; message: string }[]): string {
  if (issues.length === 0) return "Existem linhas inválidas";
  const first = issues[0];
  return `Linha ${String(first.line ?? "?")}, ${first.field}: ${first.message}`;
}

export const commitMerchantProductImport = createServerFn({ method: "POST" })
  .validator(importSchema)
  .handler(async ({ data }) => {
    const { context, userId, sql, result } = await prepareImport(data.rows);
    if (result.issues.length > 0 || result.products.length !== data.rows.length) {
      throw new Error(`Importação bloqueada. ${validationFailureDetail(result.issues)}`);
    }
    return executeAtomicImport(sql, context.scope.tenantId, context.scope.storeId, userId, result.products);
  });
