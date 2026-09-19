import type { ResolvedAsset } from "./model.ts";
import { expectedAssets } from "./plan.ts";

export function buildAssetManifestTemplate(): Partial<Record<string, ResolvedAsset>> {
  return Object.fromEntries(expectedAssets().map((asset) => [
    asset.key,
    {
      source: "REPLACE_WITH_LOCAL_GENERATED_OR_LICENSED_SOURCE",
      mimeType: "image/webp",
      sizeBytes: 0,
      sha256: "REPLACE_WITH_64_HEX_SHA256",
      storeKey: asset.storeKey,
      kind: asset.kind,
      productSlug: asset.productSlug,
    },
  ]));
}
