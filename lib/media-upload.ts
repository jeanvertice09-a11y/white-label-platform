import { ALLOWED_IMAGE_MIME, MAX_UPLOAD_BYTES } from "@white-label/storage";
import {
  createMerchantMediaUploadIntent,
  discardMerchantMediaAsset,
  finalizeMerchantMediaUpload,
} from "./server/media.functions.ts";
import {
  createControlLogoUploadIntentAction,
  discardControlLogoAssetAction,
  finalizeControlLogoUploadAction,
} from "./server/control-media.functions.ts";

export interface UploadedMediaAsset {
  id: string;
  objectKey: string;
  publicUrl: string;
  contentType: string;
  sizeBytes: number;
}

function validateFile(file: File): void {
  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) throw new Error("Formato inválido. Use JPG, PNG ou WebP.");
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) throw new Error("A imagem deve ter no máximo 10 MB.");
}

async function putFile(file: File, uploadUrl: string): Promise<void> {
  const response = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!response.ok) throw new Error(`Falha no envio da imagem (${String(response.status)}).`);
}

export async function uploadMerchantMedia(file: File, kind: "product" | "banner"): Promise<UploadedMediaAsset> {
  validateFile(file);
  const contentType = file.type as "image/jpeg" | "image/png" | "image/webp";
  const intent = await createMerchantMediaUploadIntent({ data: { kind, contentType, sizeBytes: file.size } });
  try {
    await putFile(file, intent.uploadUrl);
    const asset = await finalizeMerchantMediaUpload({ data: { assetId: intent.assetId } });
    return { id: asset.id, objectKey: asset.objectKey, publicUrl: asset.publicUrl, contentType: asset.contentType, sizeBytes: asset.sizeBytes };
  } catch (error) {
    try { await discardMerchantMediaAsset({ data: { assetId: intent.assetId } }); } catch { /* server keeps tracked failure */ }
    throw error;
  }
}

export async function discardUploadedMerchantMedia(assetId: string): Promise<void> {
  await discardMerchantMediaAsset({ data: { assetId } });
}

export async function uploadControlLogo(file: File): Promise<UploadedMediaAsset> {
  validateFile(file);
  const contentType = file.type as "image/jpeg" | "image/png" | "image/webp";
  const intent = await createControlLogoUploadIntentAction({ data: { contentType, sizeBytes: file.size } });
  try {
    await putFile(file, intent.uploadUrl);
    const asset = await finalizeControlLogoUploadAction({ data: { assetId: intent.assetId } });
    return { id: asset.id, objectKey: asset.objectKey, publicUrl: asset.publicUrl, contentType: asset.contentType, sizeBytes: asset.sizeBytes };
  } catch (error) {
    try { await discardControlLogoAssetAction({ data: { assetId: intent.assetId } }); } catch { /* server keeps tracked failure */ }
    throw error;
  }
}

export async function discardUploadedControlLogo(assetId: string): Promise<void> {
  await discardControlLogoAssetAction({ data: { assetId } });
}
