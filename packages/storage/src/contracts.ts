// Contratos R2: servidor gera keys; browser nunca escolhe prefixo alheio.

export interface UploadIntentInput {
  tenantId: string;
  storeId?: string;
  contentType: string;
  sizeBytes: number;
  extension: string;
}

export interface UploadIntent {
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  expiresAt: string;
}

export interface StorageProvider {
  createUploadIntent(input: UploadIntentInput): Promise<UploadIntent>;
  deleteObject(objectKey: string): Promise<void>;
  getPublicUrl(objectKey: string): string;
  getSignedReadUrl?(objectKey: string, expiresInSeconds: number): Promise<string>;
}

export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function assertUploadAllowed(contentType: string, sizeBytes: number): void {
  const allowed: readonly string[] = ALLOWED_IMAGE_MIME;
  if (!allowed.includes(contentType)) throw new Error(`MIME não permitido: ${contentType}`);
  if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) throw new Error("Tamanho inválido");
}
