import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createCatalogAdminRepository, createCatalogReadRepository } from "@white-label/catalog";
import type { CatalogScope, VariantMutationInput } from "@white-label/catalog";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import {
  assertCatalogFeatureEntitlement,
  assertCatalogSettingsEntitlements,
  assertProductMutationEntitlements,
  assertVariantMutationEntitlements,
} from "./catalog-entitlements.server.ts";

const nullableText = z.string().trim().max(5000).nullable();
const nullableShortText = z.string().trim().max(180).nullable();
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const position = z.number().int().min(0).max(1_000_000);
const uuid = z.string().uuid();

const productSchema = z.object({
  name: z.string().trim().min(1).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
  description: nullableText, sku: nullableShortText, categoryId: uuid.nullable(), priceCents: cents,
  compareAtPriceCents: cents.nullable(), costCents: cents.nullable(), active: z.boolean(), trackInventory: z.boolean(),
  stockQuantity: z.number().int().min(0).max(2_147_483_647), position,
});
const variantSchema = z.object({
  productId: uuid, name: z.string().trim().min(1).max(160), sku: nullableShortText,
  attributes: z.record(z.string().max(80), z.string().max(120)), priceCents: cents, compareAtPriceCents: cents.nullable(),
  costCents: cents.nullable(), active: z.boolean(), stockQuantity: z.number().int().min(0).max(2_147_483_647), position,
});
const productImageSchema = z.object({
  productId: uuid, objectKey: z.string().trim().min(1).max(1024), altText: z.string().trim().max(240).nullable(), position,
});
const categorySchema = z.object({
  name: z.string().trim().min(1).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
  description: z.string().trim().max(1000).nullable(), parentId: uuid.nullable(), active: z.boolean(), position,
});
const bannerSchema = z.object({
  title: z.string().trim().max(160).nullable(), altText: z.string().trim().max(240).nullable(),
  imageObjectKey: z.string().trim().min(1).max(1024), href: z.string().trim().url().max(2048).nullable(), active: z.boolean(), position,
});
const settingsSchema = z.object({
  layout: z.enum(["classic", "modern"]), primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i), accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i), fontFamily: z.enum(["system", "inter", "serif", "sans"]),
  showSearch: z.boolean(), showCategories: z.boolean(), showPrice: z.boolean(), showStock: z.boolean(),
  labels: z.record(z.string().max(40), z.string().max(120)), whatsappPhone: z.string().trim().max(20).nullable(),
  whatsappMessage: z.string().trim().min(1).max(500), checkoutMode: z.enum(["whatsapp", "online", "both"]),
  seoTitle: z.string().trim().max(120).nullable(), seoDescription: z.string().trim().max(320).nullable(),
});
const withId = <T extends z.ZodTypeAny>(schema: T) => z.object({ id: uuid, input: schema });
const imageId = z.object({ productId: uuid, id: uuid });
const productStatusSchema = z.object({ productId: uuid, active: z.boolean() });

function normalizeVariantInput(input: z.infer<typeof variantSchema>): VariantMutationInput {
  const attributes: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(input.attributes)) {
    const key = rawKey.trim(); const value = rawValue.trim();
    if (!key || key.length > 80 || !value || value.length > 120) throw new Error("Atributos da variante inválidos");
    if (Object.prototype.hasOwnProperty.call(attributes, key)) throw new Error("Atributo duplicado na variante");
    attributes[key] = value;
  }
  return { ...input, attributes };
}

async function adminContext() {
  const context = await createMerchantCatalogContext(getRequestHost());
  const sql = createAdminSqlExecutor();
  return { scope: context.scope, userId: context.userId, sql, repository: createCatalogAdminRepository(sql) };
}

async function auditConfiguration(
  sql: ReturnType<typeof createAdminSqlExecutor>, scope: CatalogScope, userId: string | null,
  action: string, resourceType: string, resourceId: string, metadata: Record<string, unknown>,
): Promise<void> {
  await sql.query(
    `insert into public.audit_logs (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
     values ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb) returning id`,
    [userId, scope.tenantId, scope.storeId, action, resourceType, resourceId, JSON.stringify(metadata)],
  );
}

export const createMerchantProduct = createServerFn({ method: "POST" }).validator(productSchema).handler(async ({ data }) => {
  const context = await adminContext(); await assertProductMutationEntitlements(context.sql, context.scope, "create");
  const product = await context.repository.createProduct(context.scope, { ...data, stockQuantity: 0 });
  await auditConfiguration(context.sql, context.scope, context.userId, "product.created", "product", product.id, { active: product.active, track_inventory: product.trackInventory });
  return product;
});
export const updateMerchantProduct = createServerFn({ method: "POST" }).validator(withId(productSchema)).handler(async ({ data }) => {
  const context = await adminContext(); await assertProductMutationEntitlements(context.sql, context.scope, "update");
  const product = await context.repository.updateProduct(context.scope, data.id, data.input);
  if (product) await auditConfiguration(context.sql, context.scope, context.userId, "product.updated", "product", product.id, { active: product.active, track_inventory: product.trackInventory });
  return product;
});
export const setMerchantProductStatus = createServerFn({ method: "POST" }).validator(productStatusSchema).handler(async ({ data }) => {
  const context = await adminContext(); await assertProductMutationEntitlements(context.sql, context.scope, "update");
  const rows = await context.sql.query(
    `with changed as (
       update public.products set active=$4,updated_at=now()
       where tenant_id=$1 and store_id=$2 and id=$3::uuid
       returning id
     ), audited as (
       insert into public.audit_logs (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $5::uuid,$1,$2,'product.status_changed','product',id,
         jsonb_build_object('active',$4::boolean) from changed
       returning id
     )
     select id::text from changed`,
    [context.scope.tenantId, context.scope.storeId, data.productId, data.active, context.userId],
  );
  if (!rows[0]) throw new Error("Produto não encontrado nesta loja");
  return { id: data.productId, active: data.active };
});
export const duplicateMerchantProduct = createServerFn({ method: "POST" }).validator(z.object({ productId: uuid })).handler(async ({ data }) => {
  const context = await adminContext(); await assertProductMutationEntitlements(context.sql, context.scope, "create");
  const sourceRows = await context.sql.query(
    `select name,slug from public.products where tenant_id=$1 and store_id=$2 and id=$3::uuid limit 1`,
    [context.scope.tenantId, context.scope.storeId, data.productId],
  );
  if (sourceRows.length === 0) throw new Error("Produto não encontrado nesta loja");
  const source = sourceRows[0];
  if (typeof source["name"] !== "string" || typeof source["slug"] !== "string") {
    throw new Error("Produto não encontrado nesta loja");
  }
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  const copyName = `${source["name"].slice(0, 151)} (cópia)`;
  const copySlug = `${source["slug"].slice(0, 170)}-${suffix}`;
  const rows = await context.sql.query(
    `with source as (
       select * from public.products where tenant_id=$1 and store_id=$2 and id=$3::uuid
     ), copied as (
       insert into public.products (
         tenant_id,store_id,name,slug,description,sku,category_id,price_cents,
         compare_at_price_cents,cost_cents,active,track_inventory,stock_quantity,position,updated_at
       )
       select tenant_id,store_id,$4,$5,description,null,category_id,price_cents,
         compare_at_price_cents,cost_cents,false,track_inventory,0,position+1,now()
       from source returning id
     ), copied_variants as (
       insert into public.product_variants (
         tenant_id,store_id,product_id,name,sku,attributes,price_cents,
         compare_at_price_cents,cost_cents,active,stock_quantity,position,updated_at
       )
       select v.tenant_id,v.store_id,c.id,v.name,null,v.attributes,v.price_cents,
         v.compare_at_price_cents,v.cost_cents,false,0,v.position,now()
       from public.product_variants v cross join copied c
       where v.tenant_id=$1 and v.store_id=$2 and v.product_id=$3::uuid
       returning id
     ), copied_images as (
       insert into public.product_images (
         tenant_id,store_id,product_id,variant_id,object_key,alt_text,position
       )
       select i.tenant_id,i.store_id,c.id,null,i.object_key,i.alt_text,i.position
       from public.product_images i cross join copied c
       where i.tenant_id=$1 and i.store_id=$2 and i.product_id=$3::uuid
       returning id
     ), audited as (
       insert into public.audit_logs (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $6::uuid,$1,$2,'product.duplicated','product',c.id,
         jsonb_build_object('source_product_id',$3::uuid,'variants',(select count(*) from copied_variants),'images',(select count(*) from copied_images))
       from copied c returning id
     )
     select id::text from copied`,
    [context.scope.tenantId, context.scope.storeId, data.productId, copyName, copySlug, context.userId],
  );
  const id = rows[0]?.["id"];
  if (typeof id !== "string") throw new Error("Não foi possível duplicar o produto");
  const product = await createCatalogReadRepository(context.sql).getProductById(context.scope, id);
  if (!product) throw new Error("Produto duplicado não encontrado");
  return product;
});
export const createMerchantVariant = createServerFn({ method: "POST" }).validator(variantSchema).handler(async ({ data }) => {
  const context = await adminContext(); await assertVariantMutationEntitlements(context.sql, context.scope);
  const variant = await context.repository.createVariant(context.scope, { ...normalizeVariantInput(data), stockQuantity: 0 });
  await auditConfiguration(context.sql, context.scope, context.userId, "product.variant_created", "product_variant", variant.id, { product_id: variant.productId, active: variant.active });
  return variant;
});
export const updateMerchantVariant = createServerFn({ method: "POST" }).validator(withId(variantSchema)).handler(async ({ data }) => {
  const context = await adminContext(); await assertVariantMutationEntitlements(context.sql, context.scope);
  const variant = await context.repository.updateVariant(context.scope, data.id, normalizeVariantInput(data.input));
  if (variant) await auditConfiguration(context.sql, context.scope, context.userId, "product.variant_updated", "product_variant", variant.id, { product_id: variant.productId, active: variant.active });
  return variant;
});
export const createMerchantProductImage = createServerFn({ method: "POST" }).validator(productImageSchema).handler(async ({ data }) => {
  const context = await adminContext(); await assertProductMutationEntitlements(context.sql, context.scope, "update");
  const image = await context.repository.createProductImage(context.scope, data);
  await auditConfiguration(context.sql, context.scope, context.userId, "product.image.associated", "product_image", image.id, { product_id: image.productId, position: image.position });
  return image;
});
export const updateMerchantProductImage = createServerFn({ method: "POST" }).validator(withId(productImageSchema)).handler(async ({ data }) => {
  const context = await adminContext(); await assertProductMutationEntitlements(context.sql, context.scope, "update");
  const image = await context.repository.updateProductImage(context.scope, data.id, data.input);
  if (image) await auditConfiguration(context.sql, context.scope, context.userId, "product.image.updated", "product_image", image.id, { product_id: image.productId, position: image.position });
  return image;
});
export const setMerchantPrimaryProductImage = createServerFn({ method: "POST" }).validator(imageId).handler(async ({ data }) => {
  const context = await adminContext(); await assertProductMutationEntitlements(context.sql, context.scope, "update");
  const images = await context.repository.setPrimaryProductImage(context.scope, data.productId, data.id);
  await auditConfiguration(context.sql, context.scope, context.userId, "product.image.primary", "product_image", data.id, { product_id: data.productId });
  return images;
});
export const removeMerchantProductImage = createServerFn({ method: "POST" }).validator(imageId).handler(async ({ data }) => {
  const context = await adminContext(); await assertProductMutationEntitlements(context.sql, context.scope, "update");
  const removed = await context.repository.removeProductImage(context.scope, data.productId, data.id);
  if (!removed) throw new Error("Imagem não encontrada neste produto");
  await auditConfiguration(context.sql, context.scope, context.userId, "product.image.detached", "product_image", data.id, { product_id: data.productId, physical_object_deleted: false });
  return { removed: true };
});
export const createMerchantCategory = createServerFn({ method: "POST" }).validator(categorySchema).handler(async ({ data }) => {
  const context = await adminContext();
  const category = await context.repository.createCategory(context.scope, data);
  await auditConfiguration(context.sql, context.scope, context.userId, "category.created", "category", category.id, { active: category.active, parent_id: category.parentId });
  return category;
});
export const updateMerchantCategory = createServerFn({ method: "POST" }).validator(withId(categorySchema)).handler(async ({ data }) => {
  const context = await adminContext();
  const category = await context.repository.updateCategory(context.scope, data.id, data.input);
  if (category) await auditConfiguration(context.sql, context.scope, context.userId, "category.updated", "category", category.id, { active: category.active, parent_id: category.parentId });
  return category;
});
export const createMerchantBanner = createServerFn({ method: "POST" }).validator(bannerSchema).handler(async ({ data }) => {
  const context = await adminContext(); await assertCatalogFeatureEntitlement(context.sql, context.scope, "banners");
  const banner = await context.repository.createBanner(context.scope, data);
  await auditConfiguration(context.sql, context.scope, context.userId, "storefront.banner.created", "store_banner", banner.id, { active: banner.active, position: banner.position });
  return banner;
});
export const updateMerchantBanner = createServerFn({ method: "POST" }).validator(withId(bannerSchema)).handler(async ({ data }) => {
  const context = await adminContext(); await assertCatalogFeatureEntitlement(context.sql, context.scope, "banners");
  const banner = await context.repository.updateBanner(context.scope, data.id, data.input);
  if (banner) await auditConfiguration(context.sql, context.scope, context.userId, "storefront.banner.updated", "store_banner", banner.id, { active: banner.active, position: banner.position });
  return banner;
});
export const saveMerchantCatalogSettings = createServerFn({ method: "POST" }).validator(settingsSchema).handler(async ({ data }) => {
  const context = await adminContext(); await assertCatalogSettingsEntitlements(context.sql, context.scope, data);
  const settings = await context.repository.updateSettings(context.scope, data);
  await auditConfiguration(context.sql, context.scope, context.userId, "storefront.settings.updated", "catalog_settings", context.scope.storeId, {
    layout: settings.layout, checkout_mode: settings.checkoutMode, show_search: settings.showSearch,
    show_categories: settings.showCategories, show_price: settings.showPrice, show_stock: settings.showStock,
  });
  return settings;
});
