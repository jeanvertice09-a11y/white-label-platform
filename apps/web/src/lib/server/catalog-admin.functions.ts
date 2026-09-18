import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createCatalogAdminRepository } from "@white-label/catalog";
import type { VariantMutationInput } from "@white-label/catalog";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import {
  assertProductMutationEntitlements,
  assertVariantMutationEntitlements,
} from "./catalog-entitlements.server.ts";

const nullableText = z.string().trim().max(5000).nullable();
const nullableShortText = z.string().trim().max(180).nullable();
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const position = z.number().int().min(0).max(1_000_000);

const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
  description: nullableText,
  sku: nullableShortText,
  categoryId: z.string().uuid().nullable(),
  priceCents: cents,
  compareAtPriceCents: cents.nullable(),
  costCents: cents.nullable(),
  active: z.boolean(),
  trackInventory: z.boolean(),
  stockQuantity: z.number().int().min(0).max(2_147_483_647),
  position,
});

const variantSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  sku: nullableShortText,
  attributes: z.record(z.string().max(80), z.string().max(120)),
  priceCents: cents,
  compareAtPriceCents: cents.nullable(),
  costCents: cents.nullable(),
  active: z.boolean(),
  stockQuantity: z.number().int().min(0).max(2_147_483_647),
  position,
});

const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
  description: z.string().trim().max(1000).nullable(),
  parentId: z.string().uuid().nullable(),
  active: z.boolean(),
  position,
});

const bannerSchema = z.object({
  title: z.string().trim().max(160).nullable(),
  altText: z.string().trim().max(240).nullable(),
  imageObjectKey: z.string().trim().min(1).max(1024),
  href: z.string().trim().url().max(2048).nullable(),
  active: z.boolean(),
  position,
});

const settingsSchema = z.object({
  layout: z.enum(["classic", "modern"]),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  fontFamily: z.enum(["system", "inter", "serif", "sans"]),
  showSearch: z.boolean(),
  showCategories: z.boolean(),
  showPrice: z.boolean(),
  showStock: z.boolean(),
  labels: z.record(z.string().max(40), z.string().max(120)),
  whatsappPhone: z.string().trim().max(20).nullable(),
  whatsappMessage: z.string().trim().min(1).max(500),
  checkoutMode: z.enum(["whatsapp", "online", "both"]),
  seoTitle: z.string().trim().max(120).nullable(),
  seoDescription: z.string().trim().max(320).nullable(),
});

const withId = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ id: z.string().uuid(), input: schema });

function normalizeVariantInput(input: z.infer<typeof variantSchema>): VariantMutationInput {
  const attributes: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(input.attributes)) {
    const key = rawKey.trim();
    const value = rawValue.trim();
    if (!key || key.length > 80 || !value || value.length > 120) {
      throw new Error("Atributos da variante inválidos");
    }
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      throw new Error("Atributo duplicado na variante");
    }
    attributes[key] = value;
  }
  return { ...input, attributes };
}

async function adminContext() {
  const context = await createMerchantCatalogContext(getRequestHost());
  const sql = createAdminSqlExecutor();
  return {
    scope: context.scope,
    sql,
    repository: createCatalogAdminRepository(sql),
  };
}

export const createMerchantProduct = createServerFn({ method: "POST" })
  .validator(productSchema)
  .handler(async ({ data }) => {
    const context = await adminContext();
    await assertProductMutationEntitlements(context.sql, context.scope, "create");
    return context.repository.createProduct(context.scope, { ...data, stockQuantity: 0 });
  });

export const updateMerchantProduct = createServerFn({ method: "POST" })
  .validator(withId(productSchema))
  .handler(async ({ data }) => {
    const context = await adminContext();
    await assertProductMutationEntitlements(context.sql, context.scope, "update");
    return context.repository.updateProduct(context.scope, data.id, data.input);
  });

export const createMerchantVariant = createServerFn({ method: "POST" })
  .validator(variantSchema)
  .handler(async ({ data }) => {
    const context = await adminContext();
    await assertVariantMutationEntitlements(context.sql, context.scope);
    return context.repository.createVariant(context.scope, {
      ...normalizeVariantInput(data),
      stockQuantity: 0,
    });
  });

export const updateMerchantVariant = createServerFn({ method: "POST" })
  .validator(withId(variantSchema))
  .handler(async ({ data }) => {
    const context = await adminContext();
    await assertVariantMutationEntitlements(context.sql, context.scope);
    return context.repository.updateVariant(
      context.scope,
      data.id,
      normalizeVariantInput(data.input),
    );
  });

export const createMerchantCategory = createServerFn({ method: "POST" })
  .validator(categorySchema)
  .handler(async ({ data }) => {
    const context = await adminContext();
    return context.repository.createCategory(context.scope, data);
  });

export const updateMerchantCategory = createServerFn({ method: "POST" })
  .validator(withId(categorySchema))
  .handler(async ({ data }) => {
    const context = await adminContext();
    return context.repository.updateCategory(context.scope, data.id, data.input);
  });

export const createMerchantBanner = createServerFn({ method: "POST" })
  .validator(bannerSchema)
  .handler(async ({ data }) => {
    const context = await adminContext();
    return context.repository.createBanner(context.scope, data);
  });

export const updateMerchantBanner = createServerFn({ method: "POST" })
  .validator(withId(bannerSchema))
  .handler(async ({ data }) => {
    const context = await adminContext();
    return context.repository.updateBanner(context.scope, data.id, data.input);
  });

export const saveMerchantCatalogSettings = createServerFn({ method: "POST" })
  .validator(settingsSchema)
  .handler(async ({ data }) => {
    const context = await adminContext();
    return context.repository.updateSettings(context.scope, data);
  });
