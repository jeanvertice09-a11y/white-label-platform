import { createCatalogAdminRepository, createCatalogReadRepository } from "@white-label/catalog";
import type { CatalogScope, CatalogSqlExecutor } from "@white-label/catalog";
import { createInventoryRepository } from "@white-label/inventory";
import { saveEditorVariants } from "./product-editor-variants.server.ts";
import { requireMediaAsset } from "./media.server.ts";
import type { ProductEditorInput } from "./product-editor.schema.ts";

async function setStock(sql: CatalogSqlExecutor, scope: CatalogScope, productId: string, variantId: string | null,
  quantity: number, previous: number, expected: number | undefined, actor: string | null): Promise<void> {
  if (expected !== undefined && quantity !== expected && previous !== expected) {
    throw new Error("O estoque mudou durante a edição. Recarregue o produto antes de salvar a quantidade.");
  }
  if (quantity === expected || quantity === previous) return;
  await createInventoryRepository(sql).move(scope, {
    operationId: crypto.randomUUID(), productId, variantId, kind: "set", quantity,
    reason: "Quantidade definida no cadastro ou edição do produto", createdBy: actor,
  });
}
async function savePhotos(sql: CatalogSqlExecutor, scope: CatalogScope, productId: string, data: ProductEditorInput) {
  for (const photo of data.photos) {
    const asset = await requireMediaAsset(sql,scope,photo.assetId);
    if (asset.kind !== "product" || asset.status !== "ready") throw new Error("Foto inválida ou não pertence a esta loja.");
    await sql.query(`insert into public.product_images(tenant_id,store_id,product_id,asset_id,object_key,alt_text,position)
      values($1,$2,$3,$4,$5,$6,$7) returning id`,[scope.tenantId,scope.storeId,productId,asset.id,asset.objectKey,data.input.name,photo.position]);
  }
}
export async function saveProductEditor(sql: CatalogSqlExecutor, scope: CatalogScope,
  data: ProductEditorInput, actor: string | null) {
  const repository = createCatalogAdminRepository(sql);
  let previous = 0;
  if (data.id) {
    const rows = await sql.query("select stock_quantity from public.products where tenant_id=$1 and store_id=$2 and id=$3 and deleted_at is null for update", [scope.tenantId, scope.storeId, data.id]);
    if (!rows[0]) throw new Error("Produto não encontrado nesta loja");
    previous = Number(rows[0]["stock_quantity"]);
  }
  const input = { ...data.input, stockQuantity: 0 };
  const product = data.id ? await repository.updateProduct(scope, data.id, input) : await repository.createProduct(scope, input);
  if (!product) throw new Error("Produto não encontrado nesta loja");
  await sql.query("update public.products set barcode=$4,featured=$5 where tenant_id=$1 and store_id=$2 and id=$3", [scope.tenantId, scope.storeId, product.id, data.input.barcode, data.input.featured]);
  await saveEditorVariants(sql, scope, product.id, data, actor);
  await savePhotos(sql, scope, product.id, data);
  if (!data.variants.length && data.input.trackInventory) {
    await setStock(sql, scope, product.id, null, data.input.stockQuantity, previous, data.expectedStockQuantity, actor);
  }
  await sql.query(`insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
    values($1::uuid,$2::uuid,$3::uuid,$4,'product',$5,$6::jsonb) returning id`, [actor, scope.tenantId, scope.storeId,
    data.id ? "product.updated" : "product.created", product.id, JSON.stringify({ variants: data.variants.length })]);
  return createCatalogReadRepository(sql).getProductById(scope, product.id);
}
