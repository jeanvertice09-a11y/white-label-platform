import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  PostgresCatalogAdminRepository,
  PostgresCatalogRepository,
  loadPublicCatalog,
  loadPublicProductDetail,
  normalizeMerchantBannerInput,
  normalizeMerchantCatalogSettingsInput,
  normalizeMerchantCategoryInput,
  normalizeMerchantProductInput,
  normalizeMerchantVariantInput,
} from "@white-label/catalog";
import {
  createCatalogAdminSqlExecutor,
  createCatalogSqlExecutor,
} from "./catalog-db.server.ts";
import {
  requireMerchantCatalogScope,
  resolvePublicCatalogScope,
} from "./catalog-context.server.ts";

const catalogQuerySchema = z.object({
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(48).default(24),
  search: z.string().max(120).optional(),
  categorySlug: z
    .string()
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  sort: z
    .enum(["newest", "price_asc", "price_desc", "name_asc"])
    .default("newest"),
});

const productSlugSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const productInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(180),
  slug: z.string().max(120).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().max(12000).optional(),
  sku: z.string().max(120).nullable().optional(),
  priceCents: z.number().int().min(0),
  compareAtPriceCents: z.number().int().min(0).nullable().optional(),
  costCents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
});

const variantInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  sku: z.string().max(120).nullable().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  priceCents: z.number().int().min(0),
  compareAtPriceCents: z.number().int().min(0).nullable().optional(),
  costCents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  position: z.number().int().min(0).max(100000).optional(),
});

const saveVariantsSchema = z.object({
  productId: z.string().uuid(),
  variants: z.array(variantInputSchema).max(100),
});

const categoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  slug: z.string().max(120).optional(),
  parentId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  position: z.number().int().min(0).max(100000).optional(),
});

const catalogSettingsSchema = z.object({
  layout: z.enum(["classic", "modern"]).optional(),
  primaryColor: z.string().max(7).optional(),
  accentColor: z.string().max(7).optional(),
  backgroundColor: z.string().max(7).optional(),
  fontKey: z
    .enum(["system", "inter", "manrope", "poppins", "montserrat", "playfair"])
    .optional(),
  showSearch: z.boolean().optional(),
  showCategories: z.boolean().optional(),
  showStock: z.boolean().optional(),
  showPrices: z.boolean().optional(),
  checkoutMode: z.enum(["whatsapp", "online", "both"]).optional(),
  whatsappPhone: z.string().max(20).nullable().optional(),
  whatsappMessageTemplate: z.string().max(1000).optional(),
  seoTitle: z.string().max(160).nullable().optional(),
  seoDescription: z.string().max(320).nullable().optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

const bannerSchema = z.object({
  id: z.string().uuid().optional(),
  objectKey: z.string().min(1).max(500),
  title: z.string().max(180).nullable().optional(),
  subtitle: z.string().max(320).nullable().optional(),
  linkUrl: z.string().max(2048).nullable().optional(),
  active: z.boolean().optional(),
  position: z.number().int().min(0).max(100000).optional(),
});

const bannerDeleteSchema = z.object({
  id: z.string().uuid(),
});

async function getPublicStoreIdentity(
  tenantId: string,
  storeId: string,
): Promise<{ name: string; slug: string }> {
  const rows = await createCatalogSqlExecutor().query(
    `select name, slug
       from public.stores
      where tenant_id = $1
        and id = $2
        and status = 'active'
      limit 1`,
    [tenantId, storeId],
  );
  const row = rows[0];
  if (!row || typeof row["name"] !== "string" || typeof row["slug"] !== "string") {
    throw new Error("Loja não encontrada");
  }
  return { name: row["name"], slug: row["slug"] };
}

function publicMediaBaseUrl(): string | null {
  const raw = process.env["R2_PUBLIC_BASE_URL"]?.trim();
  return raw ? raw.replace(/\/$/, "") : null;
}

function noStore(): void {
  setResponseHeader("Cache-Control", "private, no-store");
}

function publicRevalidate(): void {
  setResponseHeader("Cache-Control", "public, max-age=0, must-revalidate");
}

export const getPublicCatalogData = createServerFn({ method: "GET" })
  .validator(catalogQuerySchema)
  .handler(async ({ data }) => {
    publicRevalidate();
    const scope = await resolvePublicCatalogScope();
    const repository = new PostgresCatalogRepository(createCatalogSqlExecutor());

    const [store, catalog] = await Promise.all([
      getPublicStoreIdentity(scope.tenantId, scope.storeId),
      loadPublicCatalog(scope, data, repository),
    ]);

    return {
      store,
      catalog,
      mediaBaseUrl: publicMediaBaseUrl(),
    };
  });

export const getPublicProductData = createServerFn({ method: "GET" })
  .validator(productSlugSchema)
  .handler(async ({ data }) => {
    publicRevalidate();
    const scope = await resolvePublicCatalogScope();
    const repository = new PostgresCatalogRepository(createCatalogSqlExecutor());

    const [store, detail] = await Promise.all([
      getPublicStoreIdentity(scope.tenantId, scope.storeId),
      loadPublicProductDetail(scope, data.slug, repository),
    ]);

    return {
      store,
      detail,
      mediaBaseUrl: publicMediaBaseUrl(),
    };
  });

export const saveMerchantProduct = createServerFn({ method: "POST" })
  .validator(productInputSchema)
  .handler(async ({ data }) => {
    noStore();
    const scope = await requireMerchantCatalogScope();
    const repository = new PostgresCatalogAdminRepository(
      createCatalogAdminSqlExecutor(),
    );
    const normalized = normalizeMerchantProductInput(data);

    const id = data.id
      ? await repository.updateProduct(scope, data.id, normalized).then(() => data.id!)
      : await repository.createProduct(scope, normalized);

    return { id };
  });

export const setMerchantProductActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ data }) => {
    noStore();
    const scope = await requireMerchantCatalogScope();
    const repository = new PostgresCatalogAdminRepository(
      createCatalogAdminSqlExecutor(),
    );
    await repository.setProductActive(scope, data.id, data.active);
    return { ok: true };
  });

export const saveMerchantProductVariants = createServerFn({ method: "POST" })
  .validator(saveVariantsSchema)
  .handler(async ({ data }) => {
    noStore();
    const scope = await requireMerchantCatalogScope();
    const repository = new PostgresCatalogAdminRepository(
      createCatalogAdminSqlExecutor(),
    );
    await repository.replaceProductVariants(
      scope,
      data.productId,
      data.variants.map(normalizeMerchantVariantInput),
    );
    return { ok: true };
  });

export const saveMerchantCategory = createServerFn({ method: "POST" })
  .validator(categoryInputSchema)
  .handler(async ({ data }) => {
    noStore();
    const scope = await requireMerchantCatalogScope();
    const repository = new PostgresCatalogAdminRepository(
      createCatalogAdminSqlExecutor(),
    );
    const normalized = normalizeMerchantCategoryInput(data);

    const id = data.id
      ? await repository.updateCategory(scope, data.id, normalized).then(() => data.id!)
      : await repository.createCategory(scope, normalized);

    return { id };
  });

export const saveMerchantCatalogSettings = createServerFn({ method: "POST" })
  .validator(catalogSettingsSchema)
  .handler(async ({ data }) => {
    noStore();
    const scope = await requireMerchantCatalogScope();
    const repository = new PostgresCatalogAdminRepository(
      createCatalogAdminSqlExecutor(),
    );
    await repository.upsertSettings(
      scope,
      normalizeMerchantCatalogSettingsInput(data),
    );
    return { ok: true };
  });

export const saveMerchantBanner = createServerFn({ method: "POST" })
  .validator(bannerSchema)
  .handler(async ({ data }) => {
    noStore();
    const scope = await requireMerchantCatalogScope();
    const repository = new PostgresCatalogAdminRepository(
      createCatalogAdminSqlExecutor(),
    );
    const id = await repository.upsertBanner(
      scope,
      normalizeMerchantBannerInput(scope, data),
    );
    return { id };
  });

export const deleteMerchantBanner = createServerFn({ method: "POST" })
  .validator(bannerDeleteSchema)
  .handler(async ({ data }) => {
    noStore();
    const scope = await requireMerchantCatalogScope();
    const repository = new PostgresCatalogAdminRepository(
      createCatalogAdminSqlExecutor(),
    );
    await repository.deleteBanner(scope, data.id);
    return { ok: true };
  });
