import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import { assertCatalogFeatureEntitlement, assertProductMutationEntitlements } from "./catalog-entitlements.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { deleteMediaAssetIfUnused, requireMediaAsset } from "./media.server.ts";

const uuid = z.string().uuid();
const position = z.number().int().min(0).max(1_000_000);
const nullableAlt = z.string().trim().max(240).nullable();
const productCreate = z.object({ productId: uuid, assetId: uuid, altText: nullableAlt, position });
const productUpdate = z.object({ id: uuid, productId: uuid, assetId: uuid.optional(), altText: nullableAlt, position });
const productId = z.object({ id: uuid, productId: uuid });
const bannerInput = z.object({
  id: uuid.optional(),
  assetId: uuid.optional(),
  title: z.string().trim().max(160).nullable(),
  altText: nullableAlt,
  href: z.string().trim().url().max(2048).nullable(),
  active: z.boolean(),
  position,
});
const bannerId = z.object({ id: uuid });

async function context() {
  const catalog = await createMerchantCatalogContext(getRequestHost());
  if (!catalog.userId) throw new Error("Sessão de lojista obrigatória");
  return { scope: catalog.scope, userId: catalog.userId, sql: createAdminSqlExecutor() };
}

async function audit(
  ctx: Awaited<ReturnType<typeof context>>,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await ctx.sql.query(
    `insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
     values ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb)`,
    [ctx.userId, ctx.scope.tenantId, ctx.scope.storeId, action, resourceType, resourceId, JSON.stringify(metadata)],
  );
}

async function cleanup(ctx: Awaited<ReturnType<typeof context>>, assetId: string | null): Promise<boolean> {
  if (!assetId) return false;
  try {
    return await deleteMediaAssetIfUnused(ctx.sql, ctx.scope, assetId);
  } catch {
    return false;
  }
}

async function readyAsset(ctx: Awaited<ReturnType<typeof context>>, assetId: string, kind: "product" | "banner") {
  const asset = await requireMediaAsset(ctx.sql, ctx.scope, assetId);
  if (asset.kind !== kind || asset.status !== "ready") throw new Error("Asset não pertence a esta loja ou não está pronto");
  return asset;
}

export const createUploadedProductImage = createServerFn({ method: "POST" })
  .validator(productCreate)
  .handler(async ({ data }) => {
    const ctx = await context();
    await assertProductMutationEntitlements(ctx.sql, ctx.scope, "update");
    const asset = await readyAsset(ctx, data.assetId, "product");
    const rows = await ctx.sql.query(
      `insert into public.product_images(tenant_id,store_id,product_id,asset_id,object_key,alt_text,position)
       select $1::uuid,$2::uuid,p.id,$4::uuid,$5,$6,$7
       from public.products p
       where p.tenant_id=$1::uuid and p.store_id=$2::uuid and p.id=$3::uuid
       returning id::text`,
      [ctx.scope.tenantId, ctx.scope.storeId, data.productId, asset.id, asset.objectKey, data.altText, data.position],
    );
    const id = typeof rows[0]?.["id"] === "string" ? rows[0]["id"] : null;
    if (!id) {
      await cleanup(ctx, asset.id);
      throw new Error("Produto não encontrado nesta loja");
    }
    await audit(ctx, "product.image.associated", "product_image", id, { product_id: data.productId, asset_id: asset.id });
    return { id };
  });

export const updateUploadedProductImage = createServerFn({ method: "POST" })
  .validator(productUpdate)
  .handler(async ({ data }) => {
    const ctx = await context();
    await assertProductMutationEntitlements(ctx.sql, ctx.scope, "update");
    const oldRows = await ctx.sql.query(
      `select asset_id::text from public.product_images
       where tenant_id=$1::uuid and store_id=$2::uuid and product_id=$3::uuid and id=$4::uuid limit 1`,
      [ctx.scope.tenantId, ctx.scope.storeId, data.productId, data.id],
    );
    if (!oldRows[0]) throw new Error("Imagem não encontrada neste produto");
    const oldAssetId = typeof oldRows[0]["asset_id"] === "string" ? oldRows[0]["asset_id"] : null;
    let asset = null;
    if (data.assetId) asset = await readyAsset(ctx, data.assetId, "product");
    const rows = asset
      ? await ctx.sql.query(
        `update public.product_images set asset_id=$5::uuid,object_key=$6,alt_text=$7,position=$8
         where tenant_id=$1::uuid and store_id=$2::uuid and product_id=$3::uuid and id=$4::uuid returning id::text`,
        [ctx.scope.tenantId, ctx.scope.storeId, data.productId, data.id, asset.id, asset.objectKey, data.altText, data.position],
      )
      : await ctx.sql.query(
        `update public.product_images set alt_text=$5,position=$6
         where tenant_id=$1::uuid and store_id=$2::uuid and product_id=$3::uuid and id=$4::uuid returning id::text`,
        [ctx.scope.tenantId, ctx.scope.storeId, data.productId, data.id, data.altText, data.position],
      );
    if (!rows[0]) throw new Error("Imagem não encontrada neste produto");
    if (asset && oldAssetId && oldAssetId !== asset.id) await cleanup(ctx, oldAssetId);
    await audit(ctx, "product.image.updated", "product_image", data.id, { product_id: data.productId, asset_replaced: Boolean(asset) });
    return { id: data.id };
  });

export const removeUploadedProductImage = createServerFn({ method: "POST" })
  .validator(productId)
  .handler(async ({ data }) => {
    const ctx = await context();
    await assertProductMutationEntitlements(ctx.sql, ctx.scope, "update");
    const rows = await ctx.sql.query(
      `delete from public.product_images
       where tenant_id=$1::uuid and store_id=$2::uuid and product_id=$3::uuid and id=$4::uuid
       returning id::text,asset_id::text`,
      [ctx.scope.tenantId, ctx.scope.storeId, data.productId, data.id],
    );
    if (!rows[0]) throw new Error("Imagem não encontrada neste produto");
    const assetId = typeof rows[0]["asset_id"] === "string" ? rows[0]["asset_id"] : null;
    const physicalDeleted = await cleanup(ctx, assetId);
    await audit(ctx, "product.image.removed", "product_image", data.id, { product_id: data.productId, physical_object_deleted: physicalDeleted });
    return { removed: true, physicalDeleted };
  });

export const saveUploadedBanner = createServerFn({ method: "POST" })
  .validator(bannerInput)
  .handler(async ({ data }) => {
    const ctx = await context();
    await assertCatalogFeatureEntitlement(ctx.sql, ctx.scope, "banners");
    if (!data.id && !data.assetId) throw new Error("Imagem do banner é obrigatória");
    const asset = data.assetId ? await readyAsset(ctx, data.assetId, "banner") : null;
    if (!data.id && asset) {
      const rows = await ctx.sql.query(
        `insert into public.store_banners(tenant_id,store_id,asset_id,title,alt_text,image_object_key,href,active,position,updated_at)
         values ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,now()) returning id::text`,
        [ctx.scope.tenantId, ctx.scope.storeId, asset.id, data.title, data.altText, asset.objectKey, data.href, data.active, data.position],
      );
      const id = typeof rows[0]?.["id"] === "string" ? rows[0]["id"] : null;
      if (!id) { await cleanup(ctx, asset.id); throw new Error("Não foi possível criar o banner"); }
      await audit(ctx, "storefront.banner.created", "store_banner", id, { asset_id: asset.id });
      return { id };
    }
    if (!data.id) throw new Error("Banner inválido");
    const oldRows = await ctx.sql.query(
      `select asset_id::text from public.store_banners where tenant_id=$1::uuid and store_id=$2::uuid and id=$3::uuid limit 1`,
      [ctx.scope.tenantId, ctx.scope.storeId, data.id],
    );
    if (!oldRows[0]) throw new Error("Banner não encontrado nesta loja");
    const oldAssetId = typeof oldRows[0]["asset_id"] === "string" ? oldRows[0]["asset_id"] : null;
    const rows = asset
      ? await ctx.sql.query(
        `update public.store_banners set asset_id=$4::uuid,title=$5,alt_text=$6,image_object_key=$7,href=$8,active=$9,position=$10,updated_at=now()
         where tenant_id=$1::uuid and store_id=$2::uuid and id=$3::uuid returning id::text`,
        [ctx.scope.tenantId, ctx.scope.storeId, data.id, asset.id, data.title, data.altText, asset.objectKey, data.href, data.active, data.position],
      )
      : await ctx.sql.query(
        `update public.store_banners set title=$4,alt_text=$5,href=$6,active=$7,position=$8,updated_at=now()
         where tenant_id=$1::uuid and store_id=$2::uuid and id=$3::uuid returning id::text`,
        [ctx.scope.tenantId, ctx.scope.storeId, data.id, data.title, data.altText, data.href, data.active, data.position],
      );
    if (!rows[0]) throw new Error("Banner não encontrado nesta loja");
    if (asset && oldAssetId && oldAssetId !== asset.id) await cleanup(ctx, oldAssetId);
    await audit(ctx, "storefront.banner.updated", "store_banner", data.id, { asset_replaced: Boolean(asset) });
    return { id: data.id };
  });

export const removeUploadedBanner = createServerFn({ method: "POST" })
  .validator(bannerId)
  .handler(async ({ data }) => {
    const ctx = await context();
    await assertCatalogFeatureEntitlement(ctx.sql, ctx.scope, "banners");
    const rows = await ctx.sql.query(
      `delete from public.store_banners where tenant_id=$1::uuid and store_id=$2::uuid and id=$3::uuid
       returning id::text,asset_id::text`,
      [ctx.scope.tenantId, ctx.scope.storeId, data.id],
    );
    if (!rows[0]) throw new Error("Banner não encontrado nesta loja");
    const assetId = typeof rows[0]["asset_id"] === "string" ? rows[0]["asset_id"] : null;
    const physicalDeleted = await cleanup(ctx, assetId);
    await audit(ctx, "storefront.banner.removed", "store_banner", data.id, { physical_object_deleted: physicalDeleted });
    return { removed: true, physicalDeleted };
  });
