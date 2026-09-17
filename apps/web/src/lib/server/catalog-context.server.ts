import { getRequestHost } from "@tanstack/react-start/server";
import {
  DomainResolver,
  PostgresDomainStore,
} from "@white-label/domains";
import type { CatalogScope } from "@white-label/catalog";
import {
  createRealDeps,
  loadStoreAdmin,
} from "./route-context.server.ts";
import { createCatalogSqlExecutor } from "./catalog-db.server.ts";

function normalizeRequestHost(host: string | null): string {
  if (!host) throw new Error("Host ausente");
  return host.toLowerCase().split(":")[0]?.replace(/\.$/, "") ?? "";
}

export async function resolvePublicCatalogScope(): Promise<CatalogScope> {
  const host = normalizeRequestHost(getRequestHost());
  const resolver = new DomainResolver(
    new PostgresDomainStore(createCatalogSqlExecutor()),
  );
  const resolved = await resolver.resolve(host);

  if (
    !resolved ||
    resolved.type !== "store_catalog" ||
    !resolved.storeId
  ) {
    throw new Error("Catálogo não encontrado");
  }

  return {
    tenantId: resolved.tenantId,
    storeId: resolved.storeId,
  };
}

export async function requireMerchantCatalogScope(): Promise<CatalogScope> {
  const host = normalizeRequestHost(getRequestHost());
  const deps = await createRealDeps();
  const context = await loadStoreAdmin({ host }, deps);

  if (!context.tenantId || !context.storeId) {
    throw new Error("Loja não resolvida");
  }

  return {
    tenantId: context.tenantId,
    storeId: context.storeId,
  };
}
