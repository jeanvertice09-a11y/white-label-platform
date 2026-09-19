import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  createMerchantCatalogContext,
  createPublicCatalogContext,
} from "./catalog-context.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";

const querySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(48).default(24),
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  sort: z.enum(["position", "name", "price_asc", "price_desc"]).default("position"),
});
const slugSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180) });
const idSchema = z.object({ id: z.string().uuid() });
type QueryInput = z.input<typeof querySchema>;

async function publicSnapshot(input: QueryInput) {
  const query = querySchema.parse(input);
  const context = await createPublicCatalogContext(getRequestHost());
  const [settings, categories, banners, products] = await Promise.all([
    context.repository.getSettings(context.scope),
    context.repository.listCategories(context.scope, true),
    context.repository.listBanners(context.scope, true),
    context.repository.listProducts({ ...context.scope, ...query }, true),
  ]);
  return { store: context.store, settings, categories, banners, products, canonicalUrl: `https://${context.hostname}/catalog` };
}

async function merchantSnapshot() {
  const context = await createMerchantCatalogContext(getRequestHost());
  const [settings, categories, banners, products] = await Promise.all([
    context.repository.getSettings(context.scope),
    context.repository.listCategories(context.scope, false),
    context.repository.listBanners(context.scope, false),
    context.repository.listProducts({ ...context.scope, page: 1, pageSize: 48, sort: "position" }, false),
  ]);
  return { store: context.store, settings, categories, banners, products };
}

function domainSnapshot(row: Record<string, unknown>): { hostname: string; status: string; verifiedAt: string | null; previewUrl: string | null } {
  const hostnameValue = row["hostname"];
  const statusValue = row["status"];
  const verifiedValue = row["verified_at"];
  if (typeof hostnameValue !== "string" || typeof statusValue !== "string") throw new Error("Domínio público inválido");
  const verifiedAt = typeof verifiedValue === "string" ? verifiedValue : verifiedValue instanceof Date ? verifiedValue.toISOString() : null;
  return {
    hostname: hostnameValue,
    status: statusValue,
    verifiedAt,
    previewUrl: statusValue === "active" && verifiedAt !== null ? `https://${hostnameValue}/catalog` : null,
  };
}

export const getPublicCatalog = createServerFn({ method: "GET" })
  .validator((data: QueryInput | undefined) => querySchema.parse(data ?? {}))
  .handler(async ({ data }) => publicSnapshot(data));

export const listPublicCatalogProducts = createServerFn({ method: "GET" })
  .validator((data: QueryInput | undefined) => querySchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const context = await createPublicCatalogContext(getRequestHost());
    return context.repository.listProducts({ ...context.scope, ...data }, true);
  });

export const getPublicCatalogProduct = createServerFn({ method: "GET" })
  .validator(slugSchema)
  .handler(async ({ data }) => {
    const context = await createPublicCatalogContext(getRequestHost());
    return context.repository.getProductBySlug(context.scope, data.slug, true);
  });

export const getMerchantCatalogOverview = createServerFn({ method: "GET" })
  .handler(async () => merchantSnapshot());

export const getMerchantStorefrontStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    const context = await createMerchantCatalogContext(getRequestHost());
    const rows = await createAdminSqlExecutor().query(
      `select hostname,status,verified_at from public.domains
       where tenant_id=$1 and store_id=$2 and type='store_catalog'
       order by case when status='active' then 0 when status='pending' then 1 else 2 end,
         verified_at desc nulls last, hostname asc limit 1`,
      [context.scope.tenantId, context.scope.storeId],
    );
    if (rows.length === 0) return { store: context.store, domain: null };
    return { store: context.store, domain: domainSnapshot(rows[0]) };
  });

export const listMerchantCategories = createServerFn({ method: "GET" })
  .handler(async () => {
    const context = await createMerchantCatalogContext(getRequestHost());
    return context.repository.listCategories(context.scope, false);
  });

export const listMerchantProducts = createServerFn({ method: "GET" })
  .validator((data: QueryInput | undefined) => querySchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const context = await createMerchantCatalogContext(getRequestHost());
    return context.repository.listProducts({ ...context.scope, ...data }, false);
  });

export const getMerchantProduct = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const context = await createMerchantCatalogContext(getRequestHost());
    return context.repository.getProductById(context.scope, data.id);
  });
