function normalizeBaseUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:") {
    throw new Error("Base pública de mídia deve usar HTTPS");
  }
  return parsed.toString().replace(/\/$/, "");
}

export function buildCatalogMediaUrl(
  baseUrl: string | null,
  objectKey: string | null | undefined,
): string | null {
  if (!baseUrl || !objectKey) return null;

  const segments = objectKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));

  if (segments.length === 0) return null;
  return `${normalizeBaseUrl(baseUrl)}/${segments.join("/")}`;
}
