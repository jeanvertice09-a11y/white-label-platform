import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { DomainResolver } from "@white-label/domains";
import {
  isStorefrontDomainType,
  loginTargetForRoot,
  normalizeRoutingHost,
  rootTargetForDomainType,
  systemTargetForHost,
} from "../routing-targets.ts";
import type { LoginTarget, RootTarget } from "../routing-targets.ts";
import { createServiceDomainStore } from "./supabase-domain-store.server.ts";

export type { LoginTarget, RootTarget } from "../routing-targets.ts";

export interface RootResolution {
  target: RootTarget;
  storefront: boolean;
}

async function resolveRoot(rawHost: string | null): Promise<RootResolution> {
  const host = normalizeRoutingHost(rawHost);
  const systemTarget = systemTargetForHost(host);
  if (systemTarget !== undefined) return { target: systemTarget, storefront: false };

  const resolver = new DomainResolver(createServiceDomainStore());
  const resolved = await resolver.resolve(host);
  if (!resolved) return { target: null, storefront: false };
  return {
    target: rootTargetForDomainType(resolved.type),
    storefront: isStorefrontDomainType(resolved.type),
  };
}

export const getRootResolution = createServerFn({ method: "GET" }).handler(async () => {
  return resolveRoot(getRequestHost());
});

export const getRootTarget = createServerFn({ method: "GET" }).handler(async () => {
  return (await resolveRoot(getRequestHost())).target;
});

export const getLoginTarget = createServerFn({ method: "GET" }).handler(async (): Promise<LoginTarget> => {
  const resolution = await resolveRoot(getRequestHost());
  return loginTargetForRoot(resolution.target);
});
