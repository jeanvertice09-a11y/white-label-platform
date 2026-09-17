import type { CatalogScope } from "./types.ts";
import type {
  NormalizedMerchantBannerInput,
  NormalizedMerchantCatalogSettingsInput,
  NormalizedMerchantCategoryInput,
} from "./admin.ts";
import type { CatalogSqlExecutor } from "./postgres.ts";

function idFrom(rows: Record<string, unknown>[], resource: string): string {
  const value = rows[0]?.["id"];
  if (typeof value !== "string" || !value) {
    throw new Error(`${resource} não encontrado`);
  }
  return value;
}

export async function createCategory(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  input: NormalizedMerchantCategoryInput,
): Promise<string> {
  const rows = await sql.query(
    `insert into public.categories (
      tenant_id, store_id, parent_id, slug, name, active, position, updated_at
    ) values ($1,$2,$3,$4,$5,$6,$7,now())
    returning id`,
    [
      scope.tenantId, scope.storeId, input.parentId, input.slug,
      input.name, input.active, input.position,
    ],
  );
  return idFrom(rows, "Categoria");
}

export async function updateCategory(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  categoryId: string,
  input: NormalizedMerchantCategoryInput,
): Promise<void> {
  const rows = await sql.query(
    `update public.categories
        set parent_id = $4, slug = $5, name = $6, active = $7,
            position = $8, updated_at = now()
      where tenant_id = $1 and store_id = $2 and id = $3
    returning id`,
    [
      scope.tenantId, scope.storeId, categoryId, input.parentId,
      input.slug, input.name, input.active, input.position,
    ],
  );
  idFrom(rows, "Categoria");
}

export async function upsertSettings(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  input: NormalizedMerchantCatalogSettingsInput,
): Promise<void> {
  await sql.query(
    `insert into public.catalog_settings (
      tenant_id, store_id, layout, primary_color, accent_color,
      background_color, font_key, show_search, show_categories,
      show_stock, show_prices, checkout_mode, whatsapp_phone,
      whatsapp_message_template, currency, seo_title, seo_description,
      labels, updated_at
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
      'BRL',$15,$16,$17::jsonb,now()
    )
    on conflict (store_id) do update
      set tenant_id = excluded.tenant_id,
          layout = excluded.layout,
          primary_color = excluded.primary_color,
          accent_color = excluded.accent_color,
          background_color = excluded.background_color,
          font_key = excluded.font_key,
          show_search = excluded.show_search,
          show_categories = excluded.show_categories,
          show_stock = excluded.show_stock,
          show_prices = excluded.show_prices,
          checkout_mode = excluded.checkout_mode,
          whatsapp_phone = excluded.whatsapp_phone,
          whatsapp_message_template = excluded.whatsapp_message_template,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          labels = excluded.labels,
          updated_at = now()`,
    [
      scope.tenantId, scope.storeId, input.layout, input.primaryColor,
      input.accentColor, input.backgroundColor, input.fontKey,
      input.showSearch, input.showCategories, input.showStock,
      input.showPrices, input.checkoutMode, input.whatsappPhone,
      input.whatsappMessageTemplate, input.seoTitle, input.seoDescription,
      JSON.stringify(input.labels),
    ],
  );
}

export async function upsertBanner(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  input: NormalizedMerchantBannerInput,
): Promise<string> {
  if (!input.id) return insertBanner(sql, scope, input);

  const rows = await sql.query(
    `update public.catalog_banners
        set object_key = $4, title = $5, subtitle = $6, link_url = $7,
            active = $8, position = $9, updated_at = now()
      where tenant_id = $1 and store_id = $2 and id = $3
    returning id`,
    [
      scope.tenantId, scope.storeId, input.id, input.objectKey,
      input.title, input.subtitle, input.linkUrl, input.active, input.position,
    ],
  );
  return idFrom(rows, "Banner");
}

async function insertBanner(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  input: NormalizedMerchantBannerInput,
): Promise<string> {
  const rows = await sql.query(
    `insert into public.catalog_banners (
      tenant_id, store_id, object_key, title, subtitle, link_url,
      active, position, updated_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,now())
    returning id`,
    [
      scope.tenantId, scope.storeId, input.objectKey, input.title,
      input.subtitle, input.linkUrl, input.active, input.position,
    ],
  );
  return idFrom(rows, "Banner");
}

export async function deleteBanner(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  bannerId: string,
): Promise<void> {
  const rows = await sql.query(
    `delete from public.catalog_banners
      where tenant_id = $1 and store_id = $2 and id = $3
    returning id`,
    [scope.tenantId, scope.storeId, bannerId],
  );
  idFrom(rows, "Banner");
}
