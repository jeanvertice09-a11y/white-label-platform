import {
  assertStorefrontAvailable,
  createCatalogReadRepository,
} from "@white-label/catalog";
import type {
  CatalogReadRepository,
  CatalogScope,
  StorefrontStore,
} from "@white-label/catalog";
import { DomainResolver } from "@white-label/domains";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createServiceDomainStore } from "./supabase-domain-store.server.ts";
import { createRealDeps, loadStoreAdmin } from "./route-context.server.ts";

export interface CatalogServerContext {
  scope: CatalogScope;
  repository: CatalogReadRepository;
  store: StorefrontStore;
  hostname: string;
  userId: string | null;
}

function requireHost(host: string | null): string {
  if (!host) throw new Error("Hostname não resolvido");
  return host.toLowerCase().split(":")[0]?.replace(/\.$/, "") ?? host;
}

async function loadStore(
  scope: CatalogScope,
  repository: CatalogReadRepository,
): Promise<StorefrontStore> {
  const store = await repository.getStore(scope);
  if (!store) throw new Error("Loja não encontrada");
  return store;
}

export async function createPublicCatalogContext(
  rawHost: string | null,
): Promise<CatalogServerContext> {
  const hostname = requireHost(rawHost);
  const resolver = new DomainResolver(createServiceDomainStore());
  const resolved = await resolver.resolve(hostname);
  if (!resolved || resolved.type !== "store_catalog" || !resolved.storeId) {
    throw new Error("Catálogo não encontrado");
  }
  const scope = { tenantId: resolved.tenantId, storeId: resolved.storeId };
  const repository = createCatalogReadRepository(createAdminSqlExecutor());
  const store = await loadStore(scope, repository);
  assertStorefrontAvailable(store);
  return { scope, repository, store, hostname, userId: null };
}

export async function createMerchantCatalogContext(
  rawHost: string | null,
): Promise<CatalogServerContext> {
  const hostname = requireHost(rawHost);
  const deps = await createRealDeps();
  const auth = await loadStoreAdmin({ host: hostname }, deps);
  if (!auth.storeId) throw new Error("Loja não resolvida");
  const scope = { tenantId: String(auth.tenantId), storeId: String(auth.storeId) };
  const repository = createCatalogReadRepository(createAdminSqlExecutor());
  const store = await loadStore(scope, repository);
  return {
    scope,
    repository,
    store,
    hostname,
    userId: String(auth.userId),
  };
}
