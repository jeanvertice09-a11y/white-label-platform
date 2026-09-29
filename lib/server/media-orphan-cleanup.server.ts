import type { StorageProvider } from "@white-label/storage";
import { createR2StorageProvider } from "@white-label/storage/server";
import { deleteMediaAssetIfUnused } from "./media.server.ts";
import type { MediaScope, MediaSql } from "./media.server.ts";

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

export async function cleanupAbandonedMediaAssets(
  sql: MediaSql,
  scope: MediaScope,
  storage: StorageProvider = createR2StorageProvider(),
): Promise<void> {
  const rows = await sql.query(
    `select m.id::text
     from public.media_assets m
     where m.tenant_id=$1::uuid and m.store_id is not distinct from $2::uuid
       and (
         (m.status='pending' and m.upload_expires_at < now())
         or (
           m.status in ('ready','failed','delete_pending')
           and m.created_at < now() - interval '24 hours'
           and not exists (select 1 from public.product_images i where i.tenant_id=m.tenant_id and i.asset_id=m.id)
           and not exists (select 1 from public.store_banners b where b.tenant_id=m.tenant_id and b.asset_id=m.id)
           and not exists (select 1 from public.tenant_branding tb where tb.tenant_id=m.tenant_id and tb.logo_asset_id=m.id)
         )
       )
     order by m.created_at asc
     limit 10`,
    [scope.tenantId, scope.storeId ?? null],
  );
  for (const row of rows) {
    const assetId = text(row, "id");
    if (!assetId) continue;
    try {
      await deleteMediaAssetIfUnused(sql, scope, assetId, storage);
    } catch {
      // The asset remains tracked in a retryable failed state; never hide a provider failure as deletion success.
    }
  }
}
