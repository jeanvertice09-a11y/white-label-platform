// Contratos de mídia. O servidor gera keys; o browser nunca escolhe tenant/store/path.

export type UploadMediaKind = "product" | "banner" | "logo";

export interface UploadIntentInput {
  tenantId: string;
  storeId?: string;
  kind: UploadMediaKind;
  contentType: string;
  sizeBytes: number;
}

export interface UploadIntent {
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  expiresAt: string;
}

export interface ImageObjectMetadata {
  contentType: string;
  sizeBytes: number;
}

export interface StorageProvider {
  createUploadIntent(input: UploadIntentInput): Promise<UploadIntent>;
  inspectImageObject(objectKey: string): Promise<ImageObjectMetadata>;
  deleteObject(objectKey: string): Promise<void>;
  getPublicUrl(objectKey: string): string;
  getSignedReadUrl?(objectKey: string, expiresInSeconds: number): Promise<string>;
}

export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function assertUploadAllowed(contentType: string, sizeBytes: number): void {
  const allowed: readonly string[] = ALLOWED_IMAGE_MIME;
  if (!allowed.includes(contentType)) throw new Error(`MIME não permitido: ${contentType}`);
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error("Tamanho inválido");
  }
}

export function extensionForImageMime(contentType: string): "jpg" | "png" | "webp" {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  throw new Error(`MIME não permitido: ${contentType}`);
}

export function assertImageSignature(bytes: Uint8Array, contentType: string): void {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const webp = bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  const valid = (contentType === "image/jpeg" && jpeg)
    || (contentType === "image/png" && png)
    || (contentType === "image/webp" && webp);
  if (!valid) throw new Error("Assinatura binária não corresponde ao MIME informado");
}
