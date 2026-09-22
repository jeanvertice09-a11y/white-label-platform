import {
  assertKeyBelongsToStore,
  assertKeyBelongsToTenant,
  assertUploadAllowed,
} from "@white-label/storage";
import type { StorageProvider, UploadMediaKind } from "@white-label/storage";
import { createR2StorageProvider } from "@white-label/storage/server";

export interface MediaSql {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface MediaScope {
  tenantId: string;
  storeId?: string | null;
}

export interface MediaAsset {
  id: string;
  tenantId: string;
  storeId: string | null;
  objectKey: string;
  publicUrl: string;
  kind: UploadMediaKind;
  contentType: string;
  sizeBytes: number;
  status: "pending" | "ready" | "delete_pending" | "deleted" | "failed";
  uploadExpiresAt: string;
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function mapAsset(row: Record<string, unknown>): MediaAsset {
  const kind = text(row, "kind");
  const status = text(row, "status");
  if (kind !== "product" && kind !== "banner" && kind !== "logo") throw new Error("Asset de mídia inválido");
  if (status !== "pending" && status !== "ready" && status !== "delete_pending" && status !== "deleted" && status !== "failed") {
    throw new Error("Estado de mídia inválido");
  }
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    storeId: nullableText(row, "store_id"),
    objectKey: text(row, "object_key"),
    publicUrl: text(row, "public_url"),
    kind,
    contentType: text(row, "content_type"),
    sizeBytes: Number(row["size_bytes"] ?? 0),
    status,
    uploadExpiresAt: text(row, "upload_expires_at"),
  };
}

function assertKindScope(scope: MediaScope, kind: UploadMediaKind): void {
  if (kind === "logo") {
    if (scope.storeId) throw new Error("Logo White Label deve ser tenant-scoped");
    return;
  }
  if (!scope.storeId) throw new Error("Mídia de loja exige store resolvida");
}

function assertObjectScope(asset: MediaAsset): void {
  if (asset.kind === "logo") {
    assertKeyBelongsToTenant(asset.objectKey, asset.tenantId);
    const prefix = `tenants/${asset.tenantId.toLowerCase()}/logo/`;
    if (!asset.objectKey.toLowerCase().startsWith(prefix)) throw new Error("Key de logo fora do tenant");
    return;
  }
  if (!asset.storeId) throw new Error("Asset de loja sem store");
  assertKeyBelongsToStore(asset.objectKey, asset.tenantId, asset.storeId);
}

function scopedStore(scope: MediaScope): string | null {
  return scope.storeId ?? null;
}

async function readAsset(sql: MediaSql, scope: MediaScope, assetId: string): Promise<MediaAsset | null> {
  const rows = await sql.query(
    `select id::text,tenant_id::text,store_id::text,object_key,public_url,kind,content_type,
            size_bytes,status,upload_expires_at::text
     from public.media_assets
     where tenant_id=$1::uuid and store_id is not distinct from $2::uuid and id=$3::uuid
     limit 1`,
    [scope.tenantId, scopedStore(scope), assetId],
  );
  return rows[0] ? mapAsset(rows[0]) : null;
}

export async function requireReadyMediaAssetByObjectKey(
  sql: MediaSql,
  scope: MediaScope,
  kind: UploadMediaKind,
  objectKey: string,
): Promise<MediaAsset> {
  assertKindScope(scope, kind);
  const rows = await sql.query(
    `select id::text,tenant_id::text,store_id::text,object_key,public_url,kind,content_type,
            size_bytes,status,upload_expires_at::text
     from public.media_assets
     where tenant_id=$1::uuid and store_id is not distinct from $2::uuid
       and object_key=$3 and kind=$4 and status='ready'
     limit 1`,
    [scope.tenantId, scopedStore(scope), objectKey, kind],
  );
  if (!rows[0]) throw new Error("Asset de mídia não pertence a este escopo ou não está pronto");
  const asset = mapAsset(rows[0]);
  assertObjectScope(asset);
  return asset;
}

export async function requireMediaAsset(
  sql: MediaSql,
  scope: MediaScope,
  assetId: string,
): Promise<MediaAsset> {
  const asset = await readAsset(sql, scope, assetId);
  if (!asset) throw new Error("Asset de mídia não encontrado neste escopo");
  assertObjectScope(asset);
  return asset;
}

async function usageCount(sql: MediaSql, asset: MediaAsset): Promise<number> {
  const rows = await sql.query(
    `select
      (select count(*) from public.product_images where tenant_id=$1::uuid and asset_id=$2::uuid) +
      (select count(*) from public.store_banners where tenant_id=$1::uuid and asset_id=$2::uuid) +
      (select count(*) from public.tenant_branding where tenant_id=$1::uuid and logo_asset_id=$2::uuid)
      as usages`,
    [asset.tenantId, asset.id],
  );
  return Number(rows[0]?.["usages"] ?? 0);
}

async function markFailure(sql: MediaSql, asset: MediaAsset, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message.slice(0, 1000) : "Falha de mídia";
  await sql.query(
    `update public.media_assets set status='failed',last_error=$4,updated_at=now()
     where tenant_id=$1::uuid and store_id is not distinct from $2::uuid and id=$3::uuid and status <> 'deleted'`,
    [asset.tenantId, asset.storeId, asset.id, message],
  );
}

export async function deleteMediaAssetIfUnused(
  sql: MediaSql,
  scope: MediaScope,
  assetId: string,
  storage: StorageProvider = createR2StorageProvider(),
): Promise<boolean> {
  const asset = await requireMediaAsset(sql, scope, assetId);
  if (asset.status === "deleted") return true;
  if (await usageCount(sql, asset) > 0) return false;
  const transitioned = await sql.query(
    `update public.media_assets set status='delete_pending',last_error=null,updated_at=now()
     where tenant_id=$1::uuid and store_id is not distinct from $2::uuid and id=$3::uuid
       and status in ('pending','ready','failed','delete_pending')
     returning id`,
    [asset.tenantId, asset.storeId, asset.id],
  );
  if (!transitioned[0]) return false;
  try {
    await storage.deleteObject(asset.objectKey);
    await sql.query(
      `update public.media_assets set status='deleted',deleted_at=now(),last_error=null,updated_at=now()
       where tenant_id=$1::uuid and store_id is not distinct from $2::uuid and id=$3::uuid and status='delete_pending'`,
      [asset.tenantId, asset.storeId, asset.id],
    );
    return true;
  } catch (error) {
    await markFailure(sql, asset, error);
    throw error;
  }
}

async function cleanupExpiredPending(
  sql: MediaSql,
  scope: MediaScope,
  storage: StorageProvider,
): Promise<void> {
  const rows = await sql.query(
    `select id::text from public.media_assets
     where tenant_id=$1::uuid and store_id is not distinct from $2::uuid
       and status='pending' and upload_expires_at < now()
     order by created_at asc limit 5`,
    [scope.tenantId, scopedStore(scope)],
  );
  for (const row of rows) {
    const id = text(row, "id");
    if (!id) continue;
    try { await deleteMediaAssetIfUnused(sql, scope, id, storage); } catch { /* retry on next mutation */ }
  }
}

export async function createMediaUploadIntent(
  sql: MediaSql,
  scope: MediaScope,
  actorUserId: string,
  kind: UploadMediaKind,
  input: { contentType: string; sizeBytes: number },
  storage: StorageProvider = createR2StorageProvider(),
): Promise<{ assetId: string; objectKey: string; publicUrl: string; uploadUrl: string; expiresAt: string; contentType: string }> {
  assertKindScope(scope, kind);
  assertUploadAllowed(input.contentType, input.sizeBytes);
  await cleanupExpiredPending(sql, scope, storage);
  const intent = await storage.createUploadIntent({
    tenantId: scope.tenantId,
    storeId: scope.storeId ?? undefined,
    kind,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  });
  const rows = await sql.query(
    `insert into public.media_assets
      (tenant_id,store_id,object_key,public_url,kind,content_type,size_bytes,status,upload_expires_at,created_by)
     values ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,'pending',$8::timestamptz,$9::uuid)
     returning id::text`,
    [scope.tenantId, scopedStore(scope), intent.objectKey, intent.publicUrl, kind, input.contentType, input.sizeBytes, intent.expiresAt, actorUserId],
  );
  const assetId = text(rows[0] ?? {}, "id");
  if (!assetId) throw new Error("Não foi possível registrar o upload");
  return { assetId, objectKey: intent.objectKey, publicUrl: intent.publicUrl, uploadUrl: intent.uploadUrl, expiresAt: intent.expiresAt, contentType: input.contentType };
}

export async function finalizeMediaUpload(
  sql: MediaSql,
  scope: MediaScope,
  assetId: string,
  storage: StorageProvider = createR2StorageProvider(),
): Promise<MediaAsset> {
  const asset = await requireMediaAsset(sql, scope, assetId);
  if (asset.status === "ready") return asset;
  if (asset.status !== "pending") throw new Error("Upload não pode ser finalizado neste estado");
  if (new Date(asset.uploadExpiresAt).getTime() < Date.now()) {
    await deleteMediaAssetIfUnused(sql, scope, asset.id, storage);
    throw new Error("Upload expirado; envie o arquivo novamente");
  }
  try {
    const metadata = await storage.inspectImageObject(asset.objectKey);
    if (metadata.contentType !== asset.contentType || metadata.sizeBytes !== asset.sizeBytes) {
      throw new Error("Arquivo armazenado não corresponde ao upload autorizado");
    }
    const rows = await sql.query(
      `update public.media_assets set status='ready',last_error=null,updated_at=now()
       where tenant_id=$1::uuid and store_id is not distinct from $2::uuid and id=$3::uuid and status='pending'
       returning id::text,tenant_id::text,store_id::text,object_key,public_url,kind,content_type,size_bytes,status,upload_expires_at::text`,
      [asset.tenantId, asset.storeId, asset.id],
    );
    if (!rows[0]) throw new Error("Upload mudou de estado durante a finalização");
    return mapAsset(rows[0]);
  } catch (error) {
    await markFailure(sql, asset, error);
    try { await storage.deleteObject(asset.objectKey); } catch { /* asset stays failed for operational cleanup */ }
    throw error;
  }
}
