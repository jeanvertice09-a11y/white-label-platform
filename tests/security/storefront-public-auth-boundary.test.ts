import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DomainResolver } from "../../packages/domains/src/index.ts";
import type { DomainRecord, DomainStore } from "../../packages/domains/src/index.ts";
import {
  HttpError,
  loadControl,
  loadMaster,
  loadStoreAdmin,
} from "../../apps/web/src/lib/server/route-context.server.ts";
import type { RouteDeps } from "../../apps/web/src/lib/server/route-context.server.ts";
import {
  isStorefrontDomainType,
  loginTargetForRoot,
  rootTargetForDomainType,
} from "../../apps/web/src/lib/routing-targets.ts";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STORE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function webSource(...segments: string[]): string {
  return readFileSync(join(import.meta.dir, "..", "..", "apps", "web", "src", ...segments), "utf8");
}

function anonymousDeps(): RouteDeps {
  return {
    resolveSession: async () => {
      await Promise.resolve();
      return null;
    },
    memberships: {
      async getPlatformRoles() {
        await Promise.resolve();
        return [];
      },
      async getTenantMemberships() {
        await Promise.resolve();
        return [];
      },
    },
    resolveTenantForHost: async () => {
      await Promise.resolve();
      return null;
    },
    getTenantStatus: async () => {
      await Promise.resolve();
      return "active";
    },
  };
}

async function expectHttpError(
  promise: Promise<unknown>,
  status: HttpError["status"],
  code: string,
): Promise<void> {
  try {
    await promise;
    throw new Error("Esperava HttpError");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    const http = error as HttpError;
    expect(http.status).toBe(status);
    expect(http.code).toBe(code);
  }
}

function storefrontRecord(hostname: string): DomainRecord {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    tenantId: TENANT,
    storeId: STORE,
    hostname,
    type: "store_catalog",
    status: "active",
    verifiedAt: "2026-09-19T12:00:00.000Z",
  };
}

function domainStore(records: DomainRecord[]): DomainStore {
  return {
    async findByHostname(hostname) {
      await Promise.resolve();
      return records.find((record) => record.hostname === hostname) ?? null;
    },
  };
}

describe("storefront public auth boundary", () => {
  test("store_catalog + visitante anônimo + / permanece storefront, nunca login", async () => {
    const resolver = new DomainResolver(domainStore([storefrontRecord("loja.example.test")]));
    const resolved = await resolver.resolve("loja.example.test");
    expect(resolved?.type).toBe("store_catalog");
    expect(resolved?.tenantId).toBe(TENANT);
    expect(resolved?.storeId).toBe(STORE);
    expect(isStorefrontDomainType(resolved?.type ?? "tenant_site")).toBe(true);
    expect(rootTargetForDomainType(resolved?.type ?? "tenant_site")).toBeNull();
    expect(loginTargetForRoot(null)).toBe("/");

    const root = webSource("routes", "index.tsx");
    expect(root).toContain("if (resolution.storefront)");
    expect(root).toContain("getPublicCatalog");
    expect(root).not.toContain("loadStoreAdminContext");
  });

  test("store_catalog + visitante anônimo + produto usa somente loader público", () => {
    const productRoute = webSource("routes", "produto.$slug.tsx");
    expect(productRoute).toContain("getPublicProductPage");
    expect(productRoute).not.toContain("client-guard");
    expect(productRoute).not.toContain("loadStoreAdminContext");
    expect(productRoute).not.toContain("/login");
  });

  test("store_admin + visitante anônimo + /admin continua protegido", async () => {
    expect(rootTargetForDomainType("store_admin")).toBe("/admin");
    await expectHttpError(
      loadStoreAdmin({ host: "admin.example.test" }, anonymousDeps()),
      401,
      "UNAUTHENTICATED",
    );
  });

  test("tenant_panel sem sessão continua protegido", async () => {
    expect(rootTargetForDomainType("tenant_panel")).toBe("/control");
    await expectHttpError(
      loadControl({ host: "painel.example.test" }, anonymousDeps()),
      401,
      "UNAUTHENTICATED",
    );
  });

  test("/master sem sessão continua protegido", async () => {
    await expectHttpError(
      loadMaster({ host: "control.geral.kataluu.com.br" }, anonymousDeps()),
      401,
      "UNAUTHENTICATED",
    );
  });

  test("domínio inexistente ou inválido falha fechado", async () => {
    const resolver = new DomainResolver(domainStore([]));
    expect(await resolver.resolve("unknown.example.test")).toBeNull();
    await expect(resolver.resolve("https://invalid.example.test/")).rejects.toThrow();
  });

  test("store_catalog válido não depende de auth.getUser ou sessão para conteúdo público", () => {
    const context = webSource("lib", "server", "catalog-context.server.ts");
    const publicStart = context.indexOf("export async function createPublicCatalogContext");
    const merchantStart = context.indexOf("export async function createMerchantCatalogContext");
    expect(publicStart).toBeGreaterThanOrEqual(0);
    expect(merchantStart).toBeGreaterThan(publicStart);
    const publicContext = context.slice(publicStart, merchantStart);
    expect(publicContext).toContain('resolved.type !== "store_catalog"');
    expect(publicContext).toContain("userId: null");
    expect(publicContext).not.toContain("auth.getUser");
    expect(publicContext).not.toContain("resolveSession");
    expect(publicContext).not.toContain("loadStoreAdmin");
    expect(publicContext).not.toContain("createRealDeps");
  });

  test("busca, categoria, carrinho e checkout WhatsApp continuam no boundary público", () => {
    const categoryRoute = webSource("routes", "categoria.$slug.tsx");
    const storefront = webSource("features", "storefront", "storefront-view.tsx");
    const checkout = webSource("lib", "server", "storefront-checkout.functions.ts");
    expect(categoryRoute).toContain("getPublicCategoryPage");
    expect(storefront).toContain("listPublicCatalogProducts");
    expect(storefront).toContain("createCart");
    expect(storefront).toContain("CartPanel");
    expect(checkout).toContain("createPublicCatalogContext");
    expect(checkout).not.toContain("loadStoreAdmin");
  });
});
