import { assertCatalogScope } from "./scope.ts";
import {
  assertCategoryInput,
  assertProductInput,
  assertVariantInput,
} from "./validation.ts";
import { mapCategory, mapProduct, mapVariant } from "./postgres-mappers.ts";
import type { CatalogSqlExecutor } from "./repository.ts";
import type {
  CategoryMutationInput,
  ProductMutationInput,
  VariantMutationInput,
} from "./admin-types.ts";
import type { CatalogScope, Category, Product, ProductVariant } from "./types.ts";

const PRODUCT_COLUMNS =
  "id,tenant_id,store_id,name,slug,description,sku,category_id,price_cents," +
  "compare_at_price_cents,cost_cents,active,track_inventory,stock_quantity,position";

async function requireCategoryInScope(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  categoryId: string | null,
): Promise<void> {
  if (!categoryId) return;
  const rows = await sql.query(
    "select id from public.categories where tenant_id=$1 and store_id=$2 and id=$3 limit 1",
    [scope.tenantId, scope.storeId, categoryId],
  );
  if (!rows[0]) throw new Error("Categoria não pertence a esta loja");
}

async function requireProductInScope(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  productId: string,
): Promise<void> {
  const rows = await sql.query(
    "select id from public.products where tenant_id=$1 and store_id=$2 and id=$3 limit 1",
    [scope.tenantId, scope.storeId, productId],
  );
  if (!rows[0]) throw new Error("Produto não pertence a esta loja");
}

async function assertCategoryParent(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  categoryId: string | null,
  parentId: string | null,
): Promise<void> {
  if (!parentId) return;
  if (categoryId && categoryId === parentId) {
    throw new Error("Categoria não pode ser pai dela mesma");
  }
  await requireCategoryInScope(sql, scope, parentId);
  if (!categoryId) return;

  const rows = await sql.query(
    `with recursive ancestors as (
       select id,parent_id from public.categories
       where tenant_id=$1 and store_id=$2 and id=$3
       union all
       select c.id,c.parent_id
       from public.categories c
       join ancestors a on c.id=a.parent_id
       where c.tenant_id=$1 and c.store_id=$2
     )
     select 1 from ancestors where id=$4 limit 1`,
    [scope.tenantId, scope.storeId, parentId, categoryId],
  );
  if (rows[0]) throw new Error("Hierarquia de categoria criaria um ciclo");
}

function hasAttributeCombination(attributes: Record<string, string>): boolean {
  return Object.keys(attributes).length > 0;
}

async function assertVariantCombinationAvailable(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  productId: string,
  attributes: Record<string, string>,
  excludeId?: string,
): Promise<void> {
  if (!hasAttributeCombination(attributes)) return;
  const params: unknown[] = [
    scope.tenantId,
    scope.storeId,
    productId,
    JSON.stringify(attributes),
  ];
  let statement =
    "select id from public.product_variants where tenant_id=$1 and store_id=$2 " +
    "and product_id=$3 and attributes=$4::jsonb";
  if (excludeId) {
    params.push(excludeId);
    statement += " and id<>$5";
  }
  statement += " limit 1";
  const rows = await sql.query(statement, params);
  if (rows[0]) throw new Error("Combinação de variante já cadastrada");
}

export async function createProduct(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  input: ProductMutationInput,
): Promise<Product> {
  assertCatalogScope(scope);
  assertProductInput(input);
  await requireCategoryInScope(sql, scope, input.categoryId);
  const rows = await sql.query(
    `insert into public.products
      (tenant_id,store_id,name,slug,description,sku,category_id,price_cents,
       compare_at_price_cents,cost_cents,active,track_inventory,stock_quantity,position,updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,$13,now())
     returning ${PRODUCT_COLUMNS}`,
    [
      scope.tenantId, scope.storeId, input.name, input.slug, input.description, input.sku,
      input.categoryId, input.priceCents, input.compareAtPriceCents, input.costCents,
      input.active, input.trackInventory, input.position,
    ],
  );
  if (!rows[0]) throw new Error("Falha ao criar produto");
  return mapProduct(rows[0]);
}

export async function updateProduct(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  id: string,
  input: ProductMutationInput,
): Promise<Product | null> {
  assertCatalogScope(scope);
  assertProductInput(input);
  await requireCategoryInScope(sql, scope, input.categoryId);
  const rows = await sql.query(
    `update public.products set
       name=$4,slug=$5,description=$6,sku=$7,category_id=$8,price_cents=$9,
       compare_at_price_cents=$10,cost_cents=$11,active=$12,track_inventory=$13,
       position=$14,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3
     returning ${PRODUCT_COLUMNS}`,
    [
      scope.tenantId, scope.storeId, id, input.name, input.slug, input.description, input.sku,
      input.categoryId, input.priceCents, input.compareAtPriceCents, input.costCents,
      input.active, input.trackInventory, input.position,
    ],
  );
  return rows[0] ? mapProduct(rows[0]) : null;
}

export async function createVariant(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  input: VariantMutationInput,
): Promise<ProductVariant> {
  assertCatalogScope(scope);
  assertVariantInput(input);
  await requireProductInScope(sql, scope, input.productId);
  await assertVariantCombinationAvailable(sql, scope, input.productId, input.attributes);
  const rows = await sql.query(
    `insert into public.product_variants
      (tenant_id,store_id,product_id,name,sku,attributes,price_cents,compare_at_price_cents,
       cost_cents,active,stock_quantity,position,updated_at)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,0,$11,now())
     returning id,tenant_id,store_id,product_id,name,sku,attributes,price_cents,
       compare_at_price_cents,cost_cents,active,stock_quantity,position`,
    [
      scope.tenantId, scope.storeId, input.productId, input.name, input.sku,
      JSON.stringify(input.attributes), input.priceCents, input.compareAtPriceCents,
      input.costCents, input.active, input.position,
    ],
  );
  if (!rows[0]) throw new Error("Falha ao criar variante");
  return mapVariant(rows[0]);
}

export async function updateVariant(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  id: string,
  input: VariantMutationInput,
): Promise<ProductVariant | null> {
  assertCatalogScope(scope);
  assertVariantInput(input);
  await requireProductInScope(sql, scope, input.productId);
  await assertVariantCombinationAvailable(sql, scope, input.productId, input.attributes, id);
  const rows = await sql.query(
    `update public.product_variants set
       name=$5,sku=$6,attributes=$7::jsonb,price_cents=$8,compare_at_price_cents=$9,
       cost_cents=$10,active=$11,position=$12,updated_at=now()
     where tenant_id=$1 and store_id=$2 and product_id=$3 and id=$4
     returning id,tenant_id,store_id,product_id,name,sku,attributes,price_cents,
       compare_at_price_cents,cost_cents,active,stock_quantity,position`,
    [
      scope.tenantId, scope.storeId, input.productId, id, input.name, input.sku,
      JSON.stringify(input.attributes), input.priceCents, input.compareAtPriceCents,
      input.costCents, input.active, input.position,
    ],
  );
  return rows[0] ? mapVariant(rows[0]) : null;
}

export async function createCategory(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  input: CategoryMutationInput,
): Promise<Category> {
  assertCatalogScope(scope);
  assertCategoryInput(input);
  await assertCategoryParent(sql, scope, null, input.parentId);
  const rows = await sql.query(
    `insert into public.categories
      (tenant_id,store_id,name,slug,description,parent_id,active,position,updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,now())
     returning id,tenant_id,store_id,name,slug,description,parent_id,active,position`,
    [
      scope.tenantId, scope.storeId, input.name, input.slug, input.description,
      input.parentId, input.active, input.position,
    ],
  );
  if (!rows[0]) throw new Error("Falha ao criar categoria");
  return mapCategory(rows[0]);
}

export async function updateCategory(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  id: string,
  input: CategoryMutationInput,
): Promise<Category | null> {
  assertCatalogScope(scope);
  assertCategoryInput(input);
  await assertCategoryParent(sql, scope, id, input.parentId);
  const rows = await sql.query(
    `update public.categories set
       name=$4,slug=$5,description=$6,parent_id=$7,active=$8,position=$9,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3
     returning id,tenant_id,store_id,name,slug,description,parent_id,active,position`,
    [
      scope.tenantId, scope.storeId, id, input.name, input.slug, input.description,
      input.parentId, input.active, input.position,
    ],
  );
  return rows[0] ? mapCategory(rows[0]) : null;
}
