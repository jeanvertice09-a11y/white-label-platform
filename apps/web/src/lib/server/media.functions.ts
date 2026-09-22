import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@white-label/storage";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import { assertCatalogFeatureEntitlement, assertProductMutationEntitlements } from "./catalog-entitlements.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import {
  createMediaUploadIntent,
  deleteMediaAssetIfUnused,
  finalizeMediaUpload,
  requireMediaAsset,
} from "./media.server.ts";
import { cleanupAbandonedMediaAssets } from "./media-orphan-cleanup.server.ts";

const uuid = z.string().uuid();
const metadataSchema = z.object({
  kind: z.enum(["product", "banner"]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});
const assetSchema = z.object({ assetId: uuid });

async function context() {
  const catalog = await createMerchantCatalogContext(getRequestHost());
  if (!catalog.userId) throw new Error("Sessão de lojista obrigatória");
  return { scope: catalog.scope, userId: catalog.userId, sql: createAdminSqlExecutor() };
}

async function authorizeKind(
  ctx: Awaited<ReturnType<typeof context>>,
  kind: "product" | "banner",
): Promise<void> {
  if (kind === "product") {
    await assertProductMutationEntitlements(ctx.sql, ctx.scope, "update");
  } else {
    await assertCatalogFeatureEntitlement(ctx.sql, ctx.scope, "banners");
  }
}

export const createMerchantMediaUploadIntent = createServerFn({ method: "POST" })
  .validator(metadataSchema)
  .handler(async ({ data }) => {
    const ctx = await context();
    await authorizeKind(ctx, data.kind);
    await cleanupAbandonedMediaAssets(ctx.sql, ctx.scope);
    return createMediaUploadIntent(ctx.sql, ctx.scope, ctx.userId, data.kind, data);
  });

export const finalizeMerchantMediaUpload = createServerFn({ method: "POST" })
  .validator(assetSchema)
  .handler(async ({ data }) => {
    const ctx = await context();
    const asset = await requireMediaAsset(ctx.sql, ctx.scope, data.assetId);
    if (asset.kind !== "product" && asset.kind !== "banner") throw new Error("Tipo de asset inválido para loja");
    await authorizeKind(ctx, asset.kind);
    return finalizeMediaUpload(ctx.sql, ctx.scope, asset.id);
  });

export const discardMerchantMediaAsset = createServerFn({ method: "POST" })
  .validator(assetSchema)
  .handler(async ({ data }) => {
    const ctx = await context();
    const asset = await requireMediaAsset(ctx.sql, ctx.scope, data.assetId);
    if (asset.kind !== "product" && asset.kind !== "banner") throw new Error("Tipo de asset inválido para loja");
    await authorizeKind(ctx, asset.kind);
    return { deleted: await deleteMediaAssetIfUnused(ctx.sql, ctx.scope, asset.id) };
  });
