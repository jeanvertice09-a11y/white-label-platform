import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { DomainResolver, PostgresDomainStore } from "@white-label/domains";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";

export type RootTarget = "/master" | "/control" | "/admin" | "/catalog" | null;

function normalizeHost(rawHost: string | null): string {
  return (rawHost ?? "").toLowerCase().split(":")[0]?.replace(/\.$/, "") ?? "";
}

async function resolveTarget(rawHost: string | null): Promise<RootTarget> {
  const host = normalizeHost(rawHost);

  if (host === "control.geral.kataluu.com.br") return "/master";
  if (host === "app.kataluu.com.br") return "/control";
  if (host === "kataluu.com.br" || host === "www.kataluu.com.br" || host === "") {
    return null;
  }

  const sql = createAdminSqlExecutor();
  const resolver = new DomainResolver(new PostgresDomainStore(sql));
  const resolved = await resolver.resolve(host);
  if (!resolved) return null;

  switch (resolved.type) {
    case "tenant_panel":
      return "/control";
    case "store_admin":
      return "/admin";
    case "store_catalog":
    case "tenant_site":
      return "/catalog";
  }
}

export const getRootTarget = createServerFn({ method: "GET" }).handler(async () => {
  return resolveTarget(getRequestHost());
});

export const getLoginTarget = createServerFn({ method: "GET" }).handler(async () => {
  const target = await resolveTarget(getRequestHost());
  return target === "/catalog" || target === null ? "/master" : target;
});
