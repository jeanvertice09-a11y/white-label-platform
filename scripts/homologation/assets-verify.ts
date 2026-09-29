import { createHash } from "node:crypto";
import type { HomologationRuntimeConfig } from "./model.ts";
import { expectedAssets } from "./plan.ts";

export interface PhysicalAssetVerification {
  assets: number;
  logos: number;
}

type FetchLike = typeof fetch;

function publicAssetUrl(config: HomologationRuntimeConfig, objectKey: string): string {
  const encoded = objectKey.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${config.mediaOrigin.replace(/\/$/, "")}/${encoded}`;
}

async function readPublishedBytes(fetchImpl: FetchLike, url: string, label: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const response = await fetchImpl(url, { method: "GET", redirect: "error" });
  if (!response.ok) throw new Error(`preflight media: ${label} indisponível (${String(response.status)})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength <= 0) throw new Error(`preflight media: ${label} vazio`);
  const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return { bytes, mimeType };
}

async function verifyAsset(config: HomologationRuntimeConfig, objectKey: string, fetchImpl: FetchLike): Promise<void> {
  const expected = config.resolvedAssets[objectKey];
  if (!expected) throw new Error(`preflight media: metadata ausente para ${objectKey}`);
  const published = await readPublishedBytes(fetchImpl, publicAssetUrl(config, objectKey), objectKey);
  if (published.bytes.byteLength !== expected.sizeBytes) {
    throw new Error(`preflight media: size divergente para ${objectKey}`);
  }
  if (published.mimeType && published.mimeType !== expected.mimeType) {
    throw new Error(`preflight media: MIME divergente para ${objectKey}`);
  }
  const sha256 = createHash("sha256").update(published.bytes).digest("hex");
  if (sha256 !== expected.sha256.toLowerCase()) throw new Error(`preflight media: sha256 divergente para ${objectKey}`);
}

async function verifyLogos(config: HomologationRuntimeConfig, fetchImpl: FetchLike): Promise<number> {
  let count = 0;
  for (const [tenantKey, url] of Object.entries(config.tenantLogoUrls)) {
    await readPublishedBytes(fetchImpl, url, `logo ${tenantKey}`);
    count += 1;
  }
  return count;
}

export async function verifyPublishedAssets(
  config: HomologationRuntimeConfig,
  fetchImpl: FetchLike = fetch,
): Promise<PhysicalAssetVerification> {
  const assets = expectedAssets();
  for (const asset of assets) await verifyAsset(config, asset.key, fetchImpl);
  const logos = await verifyLogos(config, fetchImpl);
  return { assets: assets.length, logos };
}
