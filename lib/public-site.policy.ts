import type { PublicDomainState } from "./public-site.types.ts";

const KATALUU_PUBLIC_HOSTS = new Set(["", "kataluu.com.br", "www.kataluu.com.br", "localhost", "127.0.0.1"]);

export function isKataluuPublicHost(host: string): boolean {
  return KATALUU_PUBLIC_HOSTS.has(host);
}

export function publicCanonicalUrl(host: string): string | null {
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  if (host === "www.kataluu.com.br") return "https://kataluu.com.br/";
  return `https://${host}/`;
}

export function tenantCanRenderPublicSite(status: string): boolean {
  return status === "active" || status === "trial";
}

export function unresolvedDomainState(status: string | null, verifiedAt: string | null): PublicDomainState {
  if (status === null) return "unknown";
  if (status === "suspended") return "unavailable";
  if (status !== "active" || verifiedAt === null) return "configuring";
  return "unavailable";
}

export function tenantPanelLoginUrl(hostname: string | null): string | null {
  return hostname ? `https://${hostname}/login` : null;
}
