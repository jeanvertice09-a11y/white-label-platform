import { assertKeyBelongsToStore } from "@white-label/storage";
import type { CatalogScope } from "./types.ts";

export const PUBLIC_MEDIA_ORIGIN = "https://media.kataluu.com.br";

export function getCatalogPublicMediaUrl(scope: CatalogScope, objectKey: string): string {
  assertKeyBelongsToStore(objectKey, scope.tenantId, scope.storeId);
  const encoded = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${PUBLIC_MEDIA_ORIGIN}/${encoded}`;
}
