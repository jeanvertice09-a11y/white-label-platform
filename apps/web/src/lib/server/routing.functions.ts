import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { DomainResolver } from "@white-label/domains";
import {
  loginTargetForRoot,
  normalizeRoutingHost,
  rootTargetForDomainType,
  systemTargetForHost,
} from "../routing-targets.ts";
import type { LoginTarget, RootTarget } from "../routing-targets.ts";
import { createServiceDomainStore } from "./supabase-domain-store.server.ts";

export type { LoginTarget, RootTarget } from "../routing-targets.ts";

async function resolveTarget(rawHost: string | null): Promise<RootTarget> {
  const host = normalizeRoutingHost(rawHost);
  const systemTarget = systemTargetForHost(host);
  if (systemTarget !== undefined) return systemTarget;

  const resolver = new DomainResolver(createServiceDomainStore());
  const resolved = await resolver.resolve(host);
  return resolved ? rootTargetForDomainType(resolved.type) : null;
}

export const getRootTarget = createServerFn({ method: "GET" }).handler(async () => {
  return resolveTarget(getRequestHost());
});

export const getLoginTarget = createServerFn({ method: "GET" }).handler(async (): Promise<LoginTarget> => {
  return loginTargetForRoot(await resolveTarget(getRequestHost()));
});
