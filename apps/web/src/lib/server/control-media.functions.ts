import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@white-label/storage";
import { controlMerchantMutation } from "./control-merchants.shared.server.ts";
import {
  createMediaUploadIntent,
  deleteMediaAssetIfUnused,
  finalizeMediaUpload,
  requireMediaAsset,
} from "./media.server.ts";
import { cleanupAbandonedMediaAssets } from "./media-orphan-cleanup.server.ts";

const uuid = z.string().uuid();
const metadataSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});
const assetSchema = z.object({ assetId: uuid });
const emptySchema = z.object({});

function rowText(row: Record<string, unknown> | undefined, key: string): string | null {
  const value = row?.[key];
  return typeof value === "string" ? value : null;
}

export const createControlLogoUploadIntentAction = createServerFn({ method: "POST" })
  .validator(metadataSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    const scope = { tenantId: ctx.tenantId };
    await cleanupAbandonedMediaAssets(ctx.sql, scope);
    return createMediaUploadIntent(ctx.sql, scope, ctx.actorUserId, "logo", data);
  });

export const finalizeControlLogoUploadAction = createServerFn({ method: "POST" })
  .validator(assetSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    const asset = await requireMediaAsset(ctx.sql, { tenantId: ctx.tenantId }, data.assetId);
    if (asset.kind !== "logo") throw new Error("Asset não é um logo White Label");
    return finalizeMediaUpload(ctx.sql, { tenantId: ctx.tenantId }, asset.id);
  });

export const discardControlLogoAssetAction = createServerFn({ method: "POST" })
  .validator(assetSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    const asset = await requireMediaAsset(ctx.sql, { tenantId: ctx.tenantId }, data.assetId);
    if (asset.kind !== "logo") throw new Error("Asset não é um logo White Label");
    return { deleted: await deleteMediaAssetIfUnused(ctx.sql, { tenantId: ctx.tenantId }, asset.id) };
  });

export const applyControlLogoAssetAction = createServerFn({ method: "POST" })
  .validator(assetSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    const scope = { tenantId: ctx.tenantId };
    const asset = await requireMediaAsset(ctx.sql, scope, data.assetId);
    if (asset.kind !== "logo" || asset.status !== "ready") throw new Error("Logo não está pronto para uso");
    const oldRows = await ctx.sql.query(
      `select logo_asset_id::text from public.tenant_branding where tenant_id=$1::uuid limit 1`,
      [ctx.tenantId],
    );
    const oldAssetId = rowText(oldRows[0], "logo_asset_id");
    await ctx.sql.query(
      `with changed as (
         insert into public.tenant_branding(tenant_id,logo_url,logo_asset_id)
         values ($1::uuid,$3,$4::uuid)
         on conflict (tenant_id) do update
         set logo_url=excluded.logo_url,logo_asset_id=excluded.logo_asset_id
         returning tenant_id
       ), audited as (
         insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
         select $2::uuid,$1::uuid,'control.branding.logo_updated','tenant',$1,
           jsonb_build_object('asset_id',$4::uuid) from changed
         returning id
       ) select tenant_id::text from changed`,
      [ctx.tenantId, ctx.actorUserId, asset.publicUrl, asset.id],
    );
    if (oldAssetId && oldAssetId !== asset.id) {
      try { await deleteMediaAssetIfUnused(ctx.sql, scope, oldAssetId); } catch { /* cleanup retried on later media mutation */ }
    }
    return { logoUrl: asset.publicUrl, assetId: asset.id };
  });

export const removeControlLogoAction = createServerFn({ method: "POST" })
  .validator(emptySchema)
  .handler(async () => {
    const ctx = await controlMerchantMutation();
    const scope = { tenantId: ctx.tenantId };
    const rows = await ctx.sql.query(
      `select logo_asset_id::text from public.tenant_branding where tenant_id=$1::uuid limit 1`,
      [ctx.tenantId],
    );
    const oldAssetId = rowText(rows[0], "logo_asset_id");
    await ctx.sql.query(
      `with changed as (
         update public.tenant_branding set logo_url=null,logo_asset_id=null
         where tenant_id=$1::uuid returning tenant_id
       ), audited as (
         insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
         select $2::uuid,$1::uuid,'control.branding.logo_removed','tenant',$1,'{}'::jsonb from changed
         returning id
       ) select tenant_id::text from changed`,
      [ctx.tenantId, ctx.actorUserId],
    );
    if (oldAssetId) {
      try { await deleteMediaAssetIfUnused(ctx.sql, scope, oldAssetId); } catch { /* DB is consistent; object remains tracked for cleanup */ }
    }
    return { ok: true };
  });
