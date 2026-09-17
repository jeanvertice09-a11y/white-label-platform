import { assertKeyBelongsToStore } from "@white-label/storage";
import { assertCatalogScope } from "./scope.ts";
import { assertCatalogSettings } from "./validation.ts";
import { mapBanner, mapSettings } from "./postgres-mappers.ts";
import type { CatalogSqlExecutor } from "./repository.ts";
import type {
  BannerMutationInput,
  CatalogSettingsMutationInput,
} from "./admin-types.ts";
import type { CatalogScope, CatalogSettings, StoreBanner } from "./types.ts";

export async function createBanner(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  input: BannerMutationInput,
): Promise<StoreBanner> {
  assertCatalogScope(scope);
  assertKeyBelongsToStore(input.imageObjectKey, scope.tenantId, scope.storeId);
  const rows = await sql.query(
    `insert into public.store_banners
      (tenant_id,store_id,title,alt_text,image_object_key,href,active,position,updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,now())
     returning id,tenant_id,store_id,title,alt_text,image_object_key,href,active,position`,
    [
      scope.tenantId, scope.storeId, input.title, input.altText, input.imageObjectKey,
      input.href, input.active, input.position,
    ],
  );
  if (!rows[0]) throw new Error("Falha ao criar banner");
  return mapBanner(rows[0]);
}

export async function updateBanner(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  id: string,
  input: BannerMutationInput,
): Promise<StoreBanner | null> {
  assertCatalogScope(scope);
  assertKeyBelongsToStore(input.imageObjectKey, scope.tenantId, scope.storeId);
  const rows = await sql.query(
    `update public.store_banners set
       title=$4,alt_text=$5,image_object_key=$6,href=$7,active=$8,position=$9,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3
     returning id,tenant_id,store_id,title,alt_text,image_object_key,href,active,position`,
    [
      scope.tenantId, scope.storeId, id, input.title, input.altText, input.imageObjectKey,
      input.href, input.active, input.position,
    ],
  );
  return rows[0] ? mapBanner(rows[0]) : null;
}

export async function updateSettings(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  input: CatalogSettingsMutationInput,
): Promise<CatalogSettings> {
  assertCatalogScope(scope);
  const complete: CatalogSettings = { ...scope, ...input };
  assertCatalogSettings(complete);
  const rows = await sql.query(
    `insert into public.catalog_settings
      (tenant_id,store_id,layout,primary_color,accent_color,background_color,font_family,
       show_search,show_categories,show_price,show_stock,labels,whatsapp_phone,
       whatsapp_message,checkout_mode,seo_title,seo_description,updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,now())
     on conflict (store_id) do update set
       layout=excluded.layout,primary_color=excluded.primary_color,
       accent_color=excluded.accent_color,background_color=excluded.background_color,
       font_family=excluded.font_family,show_search=excluded.show_search,
       show_categories=excluded.show_categories,show_price=excluded.show_price,
       show_stock=excluded.show_stock,labels=excluded.labels,
       whatsapp_phone=excluded.whatsapp_phone,whatsapp_message=excluded.whatsapp_message,
       checkout_mode=excluded.checkout_mode,seo_title=excluded.seo_title,
       seo_description=excluded.seo_description,updated_at=now()
     where public.catalog_settings.tenant_id=excluded.tenant_id
     returning tenant_id,store_id,layout,primary_color,accent_color,background_color,
       font_family,show_search,show_categories,show_price,show_stock,labels,whatsapp_phone,
       whatsapp_message,checkout_mode,seo_title,seo_description`,
    [
      scope.tenantId, scope.storeId, input.layout, input.primaryColor, input.accentColor,
      input.backgroundColor, input.fontFamily, input.showSearch, input.showCategories,
      input.showPrice, input.showStock, JSON.stringify(input.labels), input.whatsappPhone,
      input.whatsappMessage, input.checkoutMode, input.seoTitle, input.seoDescription,
    ],
  );
  if (!rows[0]) throw new Error("Falha ao salvar configurações");
  return mapSettings(rows[0]);
}
