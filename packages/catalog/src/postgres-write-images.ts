import { assertKeyBelongsToStore } from "@white-label/storage";
import type { ProductImageMutationInput } from "./admin-types.ts";
import { mapImage } from "./postgres-mappers.ts";
import type { CatalogSqlExecutor } from "./repository.ts";
import { assertCatalogScope } from "./scope.ts";
import type { CatalogScope, ProductImage } from "./types.ts";

async function requireProduct(sql: CatalogSqlExecutor, scope: CatalogScope, productId: string): Promise<void> {
  const rows = await sql.query(
    `select id from public.products where tenant_id=$1 and store_id=$2 and id=$3::uuid limit 1`,
    [scope.tenantId, scope.storeId, productId],
  );
  if (!rows[0]) throw new Error("Produto não encontrado nesta loja");
}

async function listProductImages(sql: CatalogSqlExecutor, scope: CatalogScope, productId: string): Promise<ProductImage[]> {
  const rows = await sql.query(
    `select id,tenant_id,store_id,product_id,variant_id,object_key,alt_text,position
     from public.product_images
     where tenant_id=$1 and store_id=$2 and product_id=$3::uuid
     order by position,id`,
    [scope.tenantId, scope.storeId, productId],
  );
  return rows.map(mapImage);
}

export async function createProductImage(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  input: ProductImageMutationInput,
): Promise<ProductImage> {
  assertCatalogScope(scope);
  assertKeyBelongsToStore(input.objectKey, scope.tenantId, scope.storeId);
  await requireProduct(sql, scope, input.productId);
  const rows = await sql.query(
    `insert into public.product_images
      (tenant_id,store_id,product_id,variant_id,object_key,alt_text,position)
     values ($1,$2,$3::uuid,null,$4,$5,$6)
     returning id,tenant_id,store_id,product_id,variant_id,object_key,alt_text,position`,
    [scope.tenantId, scope.storeId, input.productId, input.objectKey, input.altText, input.position],
  );
  if (!rows[0]) throw new Error("Falha ao associar imagem ao produto");
  return mapImage(rows[0]);
}

export async function updateProductImage(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  id: string,
  input: ProductImageMutationInput,
): Promise<ProductImage | null> {
  assertCatalogScope(scope);
  assertKeyBelongsToStore(input.objectKey, scope.tenantId, scope.storeId);
  await requireProduct(sql, scope, input.productId);
  const rows = await sql.query(
    `update public.product_images set object_key=$5,alt_text=$6,position=$7
     where tenant_id=$1 and store_id=$2 and product_id=$3::uuid and id=$4::uuid
     returning id,tenant_id,store_id,product_id,variant_id,object_key,alt_text,position`,
    [scope.tenantId, scope.storeId, input.productId, id, input.objectKey, input.altText, input.position],
  );
  return rows[0] ? mapImage(rows[0]) : null;
}

export async function setPrimaryProductImage(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  productId: string,
  id: string,
): Promise<ProductImage[]> {
  assertCatalogScope(scope);
  await requireProduct(sql, scope, productId);
  const target = await sql.query(
    `select id from public.product_images where tenant_id=$1 and store_id=$2 and product_id=$3::uuid and id=$4::uuid`,
    [scope.tenantId, scope.storeId, productId, id],
  );
  if (!target[0]) throw new Error("Imagem não encontrada neste produto");
  await sql.query(
    `with ranked as (
       select id,(row_number() over (order by case when id=$4::uuid then 0 else 1 end,position,id)-1)::integer as next_position
       from public.product_images where tenant_id=$1 and store_id=$2 and product_id=$3::uuid
     )
     update public.product_images p set position=r.next_position
     from ranked r where p.id=r.id and p.tenant_id=$1 and p.store_id=$2 and p.product_id=$3::uuid`,
    [scope.tenantId, scope.storeId, productId, id],
  );
  return listProductImages(sql, scope, productId);
}

export async function removeProductImage(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  productId: string,
  id: string,
): Promise<boolean> {
  assertCatalogScope(scope);
  const rows = await sql.query(
    `delete from public.product_images
     where tenant_id=$1 and store_id=$2 and product_id=$3::uuid and id=$4::uuid
     returning id`,
    [scope.tenantId, scope.storeId, productId, id],
  );
  return Boolean(rows[0]);
}
