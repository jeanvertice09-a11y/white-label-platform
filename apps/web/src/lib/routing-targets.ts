import type { DomainType } from "@white-label/domains";

export type RootTarget = "/master" | "/control" | "/admin" | null;
export type LoginTarget = "/master" | "/control" | "/admin" | "/";

export function normalizeRoutingHost(rawHost: string | null): string {
  return (rawHost ?? "").toLowerCase().split(":")[0]?.replace(/\.$/, "") ?? "";
}

/**
 * undefined = host não é interno Kataluu e precisa consultar DomainResolver.
 * null = host público conhecido sem painel automático.
 */
export function systemTargetForHost(host: string): RootTarget | undefined {
  if (host === "control.geral.kataluu.com.br") return "/master";
  if (host === "app.kataluu.com.br") return "/control";
  if (host === "kataluu.com.br" || host === "www.kataluu.com.br" || host === "") {
    return null;
  }
  return undefined;
}

export function isStorefrontDomainType(type: DomainType): boolean {
  return type === "store_catalog";
}

export function rootTargetForDomainType(type: DomainType): RootTarget {
  switch (type) {
    case "tenant_panel":
      return "/control";
    case "store_admin":
      return "/admin";
    case "store_catalog":
    case "tenant_site":
      return null;
  }
}

export function loginTargetForRoot(target: RootTarget): LoginTarget {
  if (target === "/master" || target === "/control" || target === "/admin") return target;
  return "/";
}
