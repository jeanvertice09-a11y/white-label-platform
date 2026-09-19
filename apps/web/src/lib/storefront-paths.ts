const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function safeSlug(slug: string): string {
  if (!SLUG.test(slug)) throw new Error("Slug público inválido");
  return slug;
}

export function storefrontProductPath(slug: string): string {
  return `/produto/${safeSlug(slug)}`;
}

export function storefrontCategoryPath(slug: string): string {
  return `/categoria/${safeSlug(slug)}`;
}

export function isLegacyCatalogPath(pathname: string): boolean {
  return pathname === "/catalog" || pathname === "/catalogo";
}

export function hasCatalogLabelConcatenation(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return normalized.startsWith("/catalog%20") || normalized.startsWith("/catalog ");
}
