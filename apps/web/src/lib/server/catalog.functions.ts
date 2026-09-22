import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  getCatalogBehavior,
  readPublicStoreProfile,
  resolvePublicCatalogMerchandising,
} from "@white-label/catalog";
import type { CatalogScope } from "@white-label/catalog";
import { storefrontCategoryPath, storefrontProductPath } from "../storefront-paths.ts";
import { createMerchantCatalogContext, createPublicCatalogContext } from "./catalog-context.server.ts";
import { resolveCatalogSettingsEntitlements } from "./catalog-entitlements.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";

const querySchema = z.object({
  page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(48).default(24),
  search: z.string().trim().max(120).optional(), categoryId: z.string().uuid().optional(),
  sort: z.enum(["position", "name", "price_asc", "price_desc"]).default("position"),
});
const slugSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180) });
const idSchema = z.object({ id: z.string().uuid() });
type QueryInput = z.input<typeof querySchema>;

async function entitledSettings(context: Awaited<ReturnType<typeof createPublicCatalogContext>>) {
  const raw = await context.repository.getSettings(context.scope);
  return resolveCatalogSettingsEntitlements(createAdminSqlExecutor(), context.scope, raw);
}

async function publicProfile(scope: CatalogScope) {
  const rows = await createAdminSqlExecutor().query(
    `select settings from public.store_settings where tenant_id=$1::uuid and store_id=$2::uuid limit 1`,
    [scope.tenantId, scope.storeId],
  );
  return readPublicStoreProfile(rows[0]?.["settings"]);
}

async function publicSnapshot(input: QueryInput) {
  const query = querySchema.parse(input);
  const context = await createPublicCatalogContext(getRequestHost());
  const [settings, categories, banners, products, profile] = await Promise.all([
    entitledSettings(context), context.repository.listCategories(context.scope, true),
    context.repository.listBanners(context.scope, true), context.repository.listProducts({ ...context.scope, ...query }, true),
    publicProfile(context.scope),
  ]);
  return {
    store: context.store, settings, categories: settings.showCategories ? categories : [], banners, products, profile,
    merchandising: resolvePublicCatalogMerchandising(settings.labels),
    canonicalUrl: `https://${context.hostname}/`,
  };
}

async function merchantSnapshot() {
  const context = await createMerchantCatalogContext(getRequestHost());
  const [settings, categories, banners, products] = await Promise.all([
    entitledSettings(context), context.repository.listCategories(context.scope, false),
    context.repository.listBanners(context.scope, false),
    context.repository.listProducts({ ...context.scope, page: 1, pageSize: 48, sort: "position" }, false),
  ]);
  return { store: context.store, settings, categories, banners, products };
}

function domainSnapshot(row: Record<string, unknown>): { hostname: string; status: string; verifiedAt: string | null; previewUrl: string | null } {
  const hostnameValue = row["hostname"]; const statusValue = row["status"]; const verifiedValue = row["verified_at"];
  if (typeof hostnameValue !== "string" || typeof statusValue !== "string") throw new Error("Domínio público inválido");
  const verifiedAt = typeof verifiedValue === "string" ? verifiedValue : verifiedValue instanceof Date ? verifiedValue.toISOString() : null;
  return { hostname: hostnameValue, status: statusValue, verifiedAt, previewUrl: statusValue === "active" && verifiedAt !== null ? `https://${hostnameValue}/` : null };
}

export const getPublicCatalog = createServerFn({ method: "GET" })
  .validator((data: QueryInput | undefined) => querySchema.parse(data ?? {})).handler(async ({ data }) => publicSnapshot(data));

export const listPublicCatalogProducts = createServerFn({ method: "GET" })
  .validator((data: QueryInput | undefined) => querySchema.parse(data ?? {})).handler(async ({ data }) => {
    const context = await createPublicCatalogContext(getRequestHost());
    const settings = await entitledSettings(context);
    const safeQuery = { ...data, search: settings.showSearch ? data.search : undefined, categoryId: settings.showCategories ? data.categoryId : undefined };
    return context.repository.listProducts({ ...context.scope, ...safeQuery }, true);
  });

export const getPublicCatalogProduct = createServerFn({ method: "GET" }).validator(slugSchema).handler(async ({ data }) => {
  const context = await createPublicCatalogContext(getRequestHost());
  return context.repository.getProductBySlug(context.scope, data.slug, true);
});

export const getPublicProductPage = createServerFn({ method: "GET" }).validator(slugSchema).handler(async ({ data }) => {
  const context = await createPublicCatalogContext(getRequestHost());
  const [settings, categories, product, profile] = await Promise.all([
    entitledSettings(context), context.repository.listCategories(context.scope, true),
    context.repository.getProductBySlug(context.scope, data.slug, true), publicProfile(context.scope),
  ]);
  if (!product) throw new Error("Produto não encontrado");
  const behavior = getCatalogBehavior(settings);
  const relatedProducts = behavior.showRelated && product.categoryId
    ? (await context.repository.listProducts({ ...context.scope, page: 1, pageSize: 6, categoryId: product.categoryId, sort: "position" }, true)).items.filter((item) => item.id !== product.id).slice(0, 4)
    : [];
  return {
    store: context.store, settings, categories: settings.showCategories ? categories : [], product, relatedProducts, profile,
    merchandising: resolvePublicCatalogMerchandising(settings.labels),
    canonicalUrl: `https://${context.hostname}${storefrontProductPath(product.slug)}`,
  };
});

export const getPublicCategoryPage = createServerFn({ method: "GET" }).validator(slugSchema).handler(async ({ data }) => {
  const context = await createPublicCatalogContext(getRequestHost());
  const [settings, categories, banners, profile] = await Promise.all([
    entitledSettings(context), context.repository.listCategories(context.scope, true), context.repository.listBanners(context.scope, true),
    publicProfile(context.scope),
  ]);
  if (!settings.showCategories) throw new Error("Categorias indisponíveis neste catálogo");
  const category = categories.find((item) => item.slug === data.slug);
  if (!category) throw new Error("Categoria não encontrada");
  const products = await context.repository.listProducts({ ...context.scope, page: 1, pageSize: 12, categoryId: category.id, sort: "position" }, true);
  return {
    store: context.store, settings, categories, banners, products, profile, category,
    merchandising: resolvePublicCatalogMerchandising(settings.labels),
    canonicalUrl: `https://${context.hostname}${storefrontCategoryPath(category.slug)}`,
  };
});

export const getMerchantCatalogOverview = createServerFn({ method: "GET" }).handler(async () => merchantSnapshot());

export const getMerchantStorefrontStatus = createServerFn({ method: "GET" }).handler(async () => {
  const context = await createMerchantCatalogContext(getRequestHost());
  const rows = await createAdminSqlExecutor().query(
    `select hostname,status,verified_at from public.domains where tenant_id=$1 and store_id=$2 and type='store_catalog'
     order by case when status='active' then 0 when status='pending' then 1 else 2 end, verified_at desc nulls last, hostname asc limit 1`,
    [context.scope.tenantId, context.scope.storeId],
  );
  if (rows.length === 0) return { store: context.store, domain: null };
  return { store: context.store, domain: domainSnapshot(rows[0]) };
});

export const listMerchantCategories = createServerFn({ method: "GET" }).handler(async () => {
  const context = await createMerchantCatalogContext(getRequestHost()); return context.repository.listCategories(context.scope, false);
});

export const listMerchantProducts = createServerFn({ method: "GET" })
  .validator((data: QueryInput | undefined) => querySchema.parse(data ?? {})).handler(async ({ data }) => {
    const context = await createMerchantCatalogContext(getRequestHost());
    return context.repository.listProducts({ ...context.scope, ...data }, false);
  });

export const getMerchantProduct = createServerFn({ method: "GET" }).validator(idSchema).handler(async ({ data }) => {
  const context = await createMerchantCatalogContext(getRequestHost()); return context.repository.getProductById(context.scope, data.id);
});
