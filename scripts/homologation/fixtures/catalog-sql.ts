import { DEMO_STORES, DEMO_TENANTS } from "./data.ts";
import type { DemoCategory, HomologationMediaMode, HomologationRuntimeConfig } from "../model.ts";
import { DEFAULT_ANCHOR_ISO, objectKey, quoteSql, stableUuid } from "../model.ts";

function json(value: unknown): string {
  return `${quoteSql(JSON.stringify(value))}::jsonb`;
}

function tenantId(storeKey: string): string {
  const store = DEMO_STORES.find((item) => item.key === storeKey);
  if (!store) throw new Error(`store ausente: ${storeKey}`);
  const tenant = DEMO_TENANTS.find((item) => item.key === store.tenantKey);
  if (!tenant) throw new Error(`tenant ausente: ${store.tenantKey}`);
  return tenant.id;
}

function categoryRows(parent: boolean): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    const tenant = tenantId(store.key);
    for (const category of store.categories.filter((item) => (item.parentKey === null) === parent)) {
      const parentId = category.parentKey === null ? "null" : `${quoteSql(store.categories.find((item) => item.key === category.parentKey)?.id ?? "")}::uuid`;
      rows.push(`(${quoteSql(category.id)}::uuid,${quoteSql(tenant)}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(category.slug)},${quoteSql(category.name)},${quoteSql(`${category.name} — curadoria ${store.name}`)},${parentId},true,${category.position},now(),now())`);
    }
  }
  return rows.join(",\n");
}

function productRows(): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    const tenant = tenantId(store.key);
    const categoryByKey = new Map<string, DemoCategory>(store.categories.map((category) => [category.key, category]));
    store.products.forEach((product, index) => {
      const category = categoryByKey.get(product.categoryKey);
      if (!category) throw new Error(`categoria ausente: ${product.categoryKey}`);
      rows.push(`(${quoteSql(product.id)}::uuid,${quoteSql(tenant)}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(category.id)}::uuid,${quoteSql(product.slug)},${quoteSql(product.name)},${product.priceCents},true,now(),${quoteSql(product.description)},${quoteSql(product.sku)},${product.compareAtPriceCents ?? "null"},${product.costCents},true,0,${index},now())`);
    });
  }
  return rows.join(",\n");
}

function variantRows(): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    const tenant = tenantId(store.key);
    for (const product of store.products) {
      product.variants.forEach((variant, index) => rows.push(
        `(${quoteSql(variant.id)}::uuid,${quoteSql(tenant)}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(product.id)}::uuid,${quoteSql(variant.name)},${quoteSql(variant.sku)},${json(variant.attributes)},${variant.priceCents},${variant.compareAtPriceCents ?? "null"},${variant.costCents},true,0,${index},now(),now())`,
      ));
    }
  }
  return rows.join(",\n");
}

function settingsRows(): string {
  return DEMO_STORES.map((store) => `(${quoteSql(tenantId(store.key))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(store.layout)},${quoteSql(store.primaryColor)},${quoteSql(store.accentColor)},'#ffffff','system',true,true,true,true,${json({ featured: "Destaques", search: "Buscar produtos" })},${quoteSql(store.whatsapp)},${quoteSql(`Olá! Quero finalizar meu pedido na ${store.name}:`)},'whatsapp',${quoteSql(`${store.name} | Catálogo`)},${quoteSql(store.description)},now())`).join(",\n");
}

function assetRows(config: HomologationRuntimeConfig, anchor: string): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    const tenant = tenantId(store.key);
    const keys = [objectKey(store, "banners/home.webp"), ...store.products.map((product) => objectKey(store, `products/${product.slug}/primary.webp`))];
    for (const key of keys) {
      const asset = config.resolvedAssets[key];
      if (!asset) throw new Error(`asset não resolvido: ${key}`);
      rows.push(`(${quoteSql(stableUuid(`media:${key}`))}::uuid,${quoteSql(tenant)}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(key)},${quoteSql(asset.mimeType)},${asset.sizeBytes},${quoteSql(anchor)}::timestamptz)`);
    }
  }
  return rows.join(",\n");
}

function productImageRows(anchor: string): string {
  const rows: string[] = [];
  for (const store of DEMO_STORES) {
    const tenant = tenantId(store.key);
    for (const product of store.products) {
      const key = objectKey(store, `products/${product.slug}/primary.webp`);
      rows.push(`(${quoteSql(stableUuid(`product-image:${store.key}:${product.id}`))}::uuid,${quoteSql(tenant)}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(product.id)}::uuid,null,${quoteSql(key)},${quoteSql(product.name)},0,${quoteSql(anchor)}::timestamptz)`);
    }
  }
  return rows.join(",\n");
}

function bannerRows(anchor: string): string {
  return DEMO_STORES.map((store) => {
    const key = objectKey(store, "banners/home.webp");
    return `(${quoteSql(stableUuid(`banner:${store.key}:home`))}::uuid,${quoteSql(tenantId(store.key))}::uuid,${quoteSql(store.id)}::uuid,${quoteSql(`Novidades ${store.name}`)},${quoteSql(`Banner principal ${store.name}`)},${quoteSql(key)},null,true,0,${quoteSql(anchor)}::timestamptz,${quoteSql(anchor)}::timestamptz)`;
  }).join(",\n");
}

function mediaSql(config: HomologationRuntimeConfig, anchor: string, mediaMode: HomologationMediaMode): string {
  if (mediaMode === "deferred") return "";
  return `
insert into public.media_assets(id,tenant_id,store_id,object_key,content_type,size_bytes,created_at) values ${assetRows(config, anchor)};
insert into public.product_images(id,tenant_id,store_id,product_id,variant_id,object_key,alt_text,position,created_at) values ${productImageRows(anchor)};
insert into public.store_banners(id,tenant_id,store_id,title,alt_text,image_object_key,href,active,position,created_at,updated_at) values ${bannerRows(anchor)};`;
}

export function buildCatalogSql(
  config: HomologationRuntimeConfig,
  mediaMode: HomologationMediaMode = "required",
): string {
  const anchor = config.anchorIso ?? DEFAULT_ANCHOR_ISO;
  return `
insert into public.categories(id,tenant_id,store_id,slug,name,description,parent_id,active,position,created_at,updated_at) values ${categoryRows(true)};
insert into public.categories(id,tenant_id,store_id,slug,name,description,parent_id,active,position,created_at,updated_at) values ${categoryRows(false)};
insert into public.products(id,tenant_id,store_id,category_id,slug,name,price_cents,active,created_at,description,sku,compare_at_price_cents,cost_cents,track_inventory,stock_quantity,position,updated_at) values ${productRows()};
insert into public.product_variants(id,tenant_id,store_id,product_id,name,sku,attributes,price_cents,compare_at_price_cents,cost_cents,active,stock_quantity,position,created_at,updated_at) values ${variantRows()};
insert into public.catalog_settings(tenant_id,store_id,layout,primary_color,accent_color,background_color,font_family,show_search,show_categories,show_price,show_stock,labels,whatsapp_phone,whatsapp_message,checkout_mode,seo_title,seo_description,updated_at) values ${settingsRows()};${mediaSql(config, anchor, mediaMode)}`;
}
