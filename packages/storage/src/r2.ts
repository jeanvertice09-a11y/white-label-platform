import {
  assertImageSignature,
  assertUploadAllowed,
  extensionForImageMime,
} from "./contracts.ts";
import type {
  ImageObjectMetadata,
  StorageProvider,
  UploadIntent,
  UploadIntentInput,
} from "./contracts.ts";
import { buildObjectKey } from "./keys.ts";

export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export class R2StorageConfigurationError extends Error {
  constructor(message = "Storage R2 não configurado") {
    super(message);
    this.name = "R2StorageConfigurationError";
  }
}

const encoder = new TextEncoder();
const SERVICE = "s3";
const REGION = "auto";

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new R2StorageConfigurationError(`Variável obrigatória ausente: ${name}`);
  return normalized;
}

export function readR2StorageConfig(env: Record<string, string | undefined> = process.env): R2StorageConfig {
  return {
    accountId: required(env["R2_ACCOUNT_ID"], "R2_ACCOUNT_ID"),
    accessKeyId: required(env["R2_ACCESS_KEY_ID"], "R2_ACCESS_KEY_ID"),
    secretAccessKey: required(env["R2_SECRET_ACCESS_KEY"], "R2_SECRET_ACCESS_KEY"),
    bucket: required(env["R2_BUCKET_MEDIA"], "R2_BUCKET_MEDIA"),
    publicBaseUrl: required(env["R2_PUBLIC_BASE_URL"], "R2_PUBLIC_BASE_URL").replace(/\/+$/, ""),
  };
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeObjectKey(objectKey: string): string {
  return objectKey.split("/").map(awsEncode).join("/");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function hex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", toArrayBuffer(encoder.encode(value))));
}

async function hmac(key: Uint8Array, value: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", toArrayBuffer(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, toArrayBuffer(encoder.encode(value))));
}

function amzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function signingKey(secret: string, shortDate: string): Promise<Uint8Array> {
  const dateKey = await hmac(encoder.encode(`AWS4${secret}`), shortDate);
  const regionKey = await hmac(dateKey, REGION);
  const serviceKey = await hmac(regionKey, SERVICE);
  return hmac(serviceKey, "aws4_request");
}

interface PresignOptions {
  method: "PUT" | "GET" | "HEAD" | "DELETE";
  objectKey: string;
  expiresSeconds: number;
  headers?: Record<string, string>;
}

async function presign(config: R2StorageConfig, options: PresignOptions): Promise<string> {
  const now = new Date();
  const timestamp = amzDate(now);
  const shortDate = timestamp.slice(0, 8);
  const scope = `${shortDate}/${REGION}/${SERVICE}/aws4_request`;
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${awsEncode(config.bucket)}/${encodeObjectKey(options.objectKey)}`;
  const normalizedHeaders: Record<string, string> = { host };
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    normalizedHeaders[name.toLowerCase()] = value.trim().replace(/\s+/g, " ");
  }
  const signedHeaderNames = Object.keys(normalizedHeaders).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${normalizedHeaders[name]}\n`).join("");
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${scope}`,
    "X-Amz-Date": timestamp,
    "X-Amz-Expires": String(options.expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  const canonicalQuery = Array.from(query.entries())
    .map(([key, value]) => [awsEncode(key), awsEncode(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const canonicalRequest = [
    options.method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", timestamp, scope, await sha256(canonicalRequest)].join("\n");
  const signature = hex(await hmac(await signingKey(config.secretAccessKey, shortDate), stringToSign));
  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export class R2StorageProvider implements StorageProvider {
  constructor(private readonly config: R2StorageConfig) {}

  getPublicUrl(objectKey: string): string {
    return `${this.config.publicBaseUrl}/${encodeObjectKey(objectKey)}`;
  }

  async createUploadIntent(input: UploadIntentInput): Promise<UploadIntent> {
    assertUploadAllowed(input.contentType, input.sizeBytes);
    const extension = extensionForImageMime(input.contentType);
    const objectKey = buildObjectKey({
      tenantId: input.tenantId,
      storeId: input.storeId,
      kind: input.kind,
      extension,
    });
    const expiresSeconds = 10 * 60;
    const uploadUrl = await presign(this.config, {
      method: "PUT",
      objectKey,
      expiresSeconds,
      headers: { "content-type": input.contentType },
    });
    return {
      objectKey,
      uploadUrl,
      publicUrl: this.getPublicUrl(objectKey),
      expiresAt: new Date(Date.now() + expiresSeconds * 1000).toISOString(),
    };
  }

  async inspectImageObject(objectKey: string): Promise<ImageObjectMetadata> {
    const headUrl = await presign(this.config, { method: "HEAD", objectKey, expiresSeconds: 60 });
    const head = await fetch(headUrl, { method: "HEAD", redirect: "error" });
    if (!head.ok) throw new Error(`Objeto R2 indisponível (${String(head.status)})`);
    const contentType = (head.headers.get("content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";
    const sizeBytes = Number(head.headers.get("content-length") ?? "0");
    assertUploadAllowed(contentType, sizeBytes);

    const range = "bytes=0-15";
    const readUrl = await presign(this.config, {
      method: "GET",
      objectKey,
      expiresSeconds: 60,
      headers: { range },
    });
    const response = await fetch(readUrl, { method: "GET", headers: { Range: range }, redirect: "error" });
    if (!response.ok) throw new Error(`Não foi possível validar o conteúdo R2 (${String(response.status)})`);
    assertImageSignature(new Uint8Array(await response.arrayBuffer()), contentType);
    return { contentType, sizeBytes };
  }

  async deleteObject(objectKey: string): Promise<void> {
    const url = await presign(this.config, { method: "DELETE", objectKey, expiresSeconds: 60 });
    const response = await fetch(url, { method: "DELETE", redirect: "error" });
    if (!response.ok && response.status !== 404) throw new Error(`Falha ao remover objeto R2 (${String(response.status)})`);
  }

  async getSignedReadUrl(objectKey: string, expiresInSeconds: number): Promise<string> {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 3600) {
      throw new Error("Expiração de leitura inválida");
    }
    return presign(this.config, { method: "GET", objectKey, expiresSeconds: expiresInSeconds });
  }
}

export function createR2StorageProvider(env?: Record<string, string | undefined>): R2StorageProvider {
  return new R2StorageProvider(readR2StorageConfig(env));
}
