import type { CatalogSqlExecutor } from "./postgres.ts";
import type { CatalogScope } from "./types.ts";
import type {
  CatalogAdminRepository,
  MerchantCatalogAdminSnapshot,
  NormalizedMerchantBannerInput,
  NormalizedMerchantCatalogSettingsInput,
  NormalizedMerchantCategoryInput,
  NormalizedMerchantProductInput,
  NormalizedMerchantVariantInput,
} from "./admin.ts";
import {
  assertCatalogAdminScope,
  normalizeMerchantCatalogSettingsInput,
} from "./admin.ts";

export interface CatalogAdminSqlExecutor extends CatalogSqlExecutor {
  transaction<T>(
    run: (tx: CatalogSqlExecutor) => Promise<T>,
  ): Promise<T>;
}

function idFrom(rows: Record<string, unknown>[], resource: string): string {
  const value = rows[0]?.["id"];
  if (typeof value !== "string" || !value) {
    throw new Error(`${resource} não encontrado`);
  }
  return value;
}

export class PostgresCatalogAdminRepository implements CatalogAdminRepository {
  constructor(private readonly sql: CatalogAdminSqlExecutor) {}

  async getSnapshot(scope: CatalogScope): Promise<MerchantCatalogAdminSnapshot> {
    assertCatalogAdminScope(scope);

    const [productRows, categoryRows, bannerRows, settingsRows] = await Promise.all([
      this.sql.query(
        `select
          id,
          category_id,
          name,
          slug,
          sku,
          price_cents,
          compare_at_price_cents,
          cost_cents,
          active,
          track_inventory,
          created_at,
          updated_at
         from public.products
        where tenant_id = $1
          and store_id = $2
        order by created_at desc, id desc`,
        [scope.tenantId, scope.storeId],
      ),
      this.sql.query(
        `select id, parent_id, name, slug, active, position
           from public.categories
          where tenant_id = $1
            and store_id = $2
          order by position asc, lower(name) asc, id asc`,
        [scope.tenantId, scope.storeId],
      ),
      this.sql.query(
        `select id, object_key, title, subtitle, link_url, active, position
           from public.catalog_banners
          where tenant_id = $1
            and store_id = $2
          order by position asc, id asc`,
        [scope.tenantId, scope.storeId],
      ),
      this.sql.query(
        `select
          layout,
          primary_color,
          accent_color,
          background_color,
          font_key,
          show_search,
          show_categories,
          show_stock,
          show_prices,
          checkout_mode,
          whatsapp_phone,
          whatsapp_message_template,
          seo_title,
          seo_description,
          labels
         from public.catalog_settings
        where tenant_id = $1
          and store_id = $2
        limit 1`,
        [scope.tenantId, scope.storeId],
      ),
    ]);

    const products = productRows.map((row) => ({
      id: String(row["id"]),
      categoryId: row["category_id"] == null ? null : String(row["category_id"]),
      name: String(row["name"]),
      slug: String(row["slug"]),
      sku: row["sku"] == null ? null : String(row["sku"]),
      priceCents: Number(row["price_cents"]),
      compareAtPriceCents:
        row["compare_at_price_cents"] == null
          ? null
          : Number(row["compare_at_price_cents"]),
      costCents: row["cost_cents"] == null ? null : Number(row["cost_cents"]),
      active: Boolean(row["active"]),
      trackInventory: Boolean(row["track_inventory"]),
      createdAt:
        row["created_at"] instanceof Date
          ? row["created_at"].toISOString()
          : String(row["created_at"]),
      updatedAt:
        row["updated_at"] instanceof Date
          ? row["updated_at"].toISOString()
          : String(row["updated_at"]),
    }));

    const categories = categoryRows.map((row) => ({
      id: String(row["id"]),
      parentId: row["parent_id"] == null ? null : String(row["parent_id"]),
      name: String(row["name"]),
      slug: String(row["slug"]),
      active: Boolean(row["active"]),
      position: Number(row["position"]),
    }));

    const banners = bannerRows.map((row) => ({
      id: String(row["id"]),
      objectKey: String(row["object_key"]),
      title: row["title"] == null ? null : String(row["title"]),
      subtitle: row["subtitle"] == null ? null : String(row["subtitle"]),
      linkUrl: row["link_url"] == null ? null : String(row["link_url"]),
      active: Boolean(row["active"]),
      position: Number(row["position"]),
    }));

    const settingsRow = settingsRows[0];
    const settings = normalizeMerchantCatalogSettingsInput(
      settingsRow
        ? {
            layout: settingsRow["layout"] as "classic" | "modern",
            primaryColor: String(settingsRow["primary_color"]),
            accentColor: String(settingsRow["accent_color"]),
            backgroundColor: String(settingsRow["background_color"]),
            fontKey: settingsRow["font_key"] as
              | "system"
              | "inter"
              | "manrope"
              | "poppins"
              | "montserrat"
              | "playfair",
            showSearch: Boolean(settingsRow["show_search"]),
            showCategories: Boolean(settingsRow["show_categories"]),
            showStock: Boolean(settingsRow["show_stock"]),
            showPrices: Boolean(settingsRow["show_prices"]),
            checkoutMode: settingsRow["checkout_mode"] as
              | "whatsapp"
              | "online"
              | "both",
            whatsappPhone:
              settingsRow["whatsapp_phone"] == null
                ? null
                : String(settingsRow["whatsapp_phone"]),
            whatsappMessageTemplate: String(
              settingsRow["whatsapp_message_template"],
            ),
            seoTitle:
              settingsRow["seo_title"] == null
                ? null
                : String(settingsRow["seo_title"]),
            seoDescription:
              settingsRow["seo_description"] == null
                ? null
                : String(settingsRow["seo_description"]),
            labels:
              settingsRow["labels"] &&
              typeof settingsRow["labels"] === "object" &&
              !Array.isArray(settingsRow["labels"])
                ? (settingsRow["labels"] as Record<string, string>)
                : {},
          }
        : {},
    );

    return { products, categories, banners, settings };
  }

  async createProduct(
    scope: CatalogScope,
    input: NormalizedMerchantProductInput,
  ): Promise<string> {
    assertCatalogAdminScope(scope);
    const rows = await this.sql.query(
      `insert into public.products (
        tenant_id,
        store_id,
        category_id,
        slug,
        name,
        description,
        sku,
        price_cents,
        compare_at_price_cents,
        cost_cents,
        active,
        track_inventory,
        updated_at
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()
      )
      returning id`,
      [
        scope.tenantId,
        scope.storeId,
        input.categoryId,
        input.slug,
        input.name,
        input.description,
        input.sku,
        input.priceCents,
        input.compareAtPriceCents,
        input.costCents,
        input.active,
        input.trackInventory,
      ],
    );
    return idFrom(rows, "Produto");
  }

  async updateProduct(
    scope: CatalogScope,
    productId: string,
    input: NormalizedMerchantProductInput,
  ): Promise<void> {
    assertCatalogAdminScope(scope);
    const rows = await this.sql.query(
      `update public.products
          set category_id = $4,
              slug = $5,
              name = $6,
              description = $7,
              sku = $8,
              price_cents = $9,
              compare_at_price_cents = $10,
              cost_cents = $11,
              active = $12,
              track_inventory = $13,
              updated_at = now()
        where tenant_id = $1
          and store_id = $2
          and id = $3
      returning id`,
      [
        scope.tenantId,
        scope.storeId,
        productId,
        input.categoryId,
        input.slug,
        input.name,
        input.description,
        input.sku,
        input.priceCents,
        input.compareAtPriceCents,
        input.costCents,
        input.active,
        input.trackInventory,
      ],
    );
    idFrom(rows, "Produto");
  }

  async setProductActive(
    scope: CatalogScope,
    productId: string,
    active: boolean,
  ): Promise<void> {
    assertCatalogAdminScope(scope);
    const rows = await this.sql.query(
      `update public.products
          set active = $4,
              updated_at = now()
        where tenant_id = $1
          and store_id = $2
          and id = $3
      returning id`,
      [scope.tenantId, scope.storeId, productId, active],
    );
    idFrom(rows, "Produto");
  }

  async replaceProductVariants(
    scope: CatalogScope,
    productId: string,
    variants: NormalizedMerchantVariantInput[],
  ): Promise<void> {
    assertCatalogAdminScope(scope);

    await this.sql.transaction(async (tx) => {
      const product = await tx.query(
        `select id
           from public.products
          where tenant_id = $1
            and store_id = $2
            and id = $3
          for update`,
        [scope.tenantId, scope.storeId, productId],
      );
      idFrom(product, "Produto");

      await tx.query(
        `delete from public.product_variants
          where tenant_id = $1
            and store_id = $2
            and product_id = $3`,
        [scope.tenantId, scope.storeId, productId],
      );

      for (const variant of variants) {
        await tx.query(
          `insert into public.product_variants (
            id,
            tenant_id,
            store_id,
            product_id,
            name,
            sku,
            attributes,
            price_cents,
            compare_at_price_cents,
            cost_cents,
            active,
            position,
            updated_at
          ) values (
            coalesce($4::uuid, gen_random_uuid()),
            $1,$2,$3,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,now()
          )`,
          [
            scope.tenantId,
            scope.storeId,
            productId,
            variant.id ?? null,
            variant.name,
            variant.sku,
            JSON.stringify(variant.attributes),
            variant.priceCents,
            variant.compareAtPriceCents,
            variant.costCents,
            variant.active,
            variant.position,
          ],
        );
      }
    });
  }

  async createCategory(
    scope: CatalogScope,
    input: NormalizedMerchantCategoryInput,
  ): Promise<string> {
    assertCatalogAdminScope(scope);
    const rows = await this.sql.query(
      `insert into public.categories (
        tenant_id,
        store_id,
        parent_id,
        slug,
        name,
        active,
        position,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,now())
      returning id`,
      [
        scope.tenantId,
        scope.storeId,
        input.parentId,
        input.slug,
        input.name,
        input.active,
        input.position,
      ],
    );
    return idFrom(rows, "Categoria");
  }

  async updateCategory(
    scope: CatalogScope,
    categoryId: string,
    input: NormalizedMerchantCategoryInput,
  ): Promise<void> {
    assertCatalogAdminScope(scope);
    const rows = await this.sql.query(
      `update public.categories
          set parent_id = $4,
              slug = $5,
              name = $6,
              active = $7,
              position = $8,
              updated_at = now()
        where tenant_id = $1
          and store_id = $2
          and id = $3
      returning id`,
      [
        scope.tenantId,
        scope.storeId,
        categoryId,
        input.parentId,
        input.slug,
        input.name,
        input.active,
        input.position,
      ],
    );
    idFrom(rows, "Categoria");
  }

  async upsertSettings(
    scope: CatalogScope,
    input: NormalizedMerchantCatalogSettingsInput,
  ): Promise<void> {
    assertCatalogAdminScope(scope);
    await this.sql.query(
      `insert into public.catalog_settings (
        tenant_id,
        store_id,
        layout,
        primary_color,
        accent_color,
        background_color,
        font_key,
        show_search,
        show_categories,
        show_stock,
        show_prices,
        checkout_mode,
        whatsapp_phone,
        whatsapp_message_template,
        currency,
        seo_title,
        seo_description,
        labels,
        updated_at
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'BRL',$15,$16,$17::jsonb,now()
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
        scope.tenantId,
        scope.storeId,
        input.layout,
        input.primaryColor,
        input.accentColor,
        input.backgroundColor,
        input.fontKey,
        input.showSearch,
        input.showCategories,
        input.showStock,
        input.showPrices,
        input.checkoutMode,
        input.whatsappPhone,
        input.whatsappMessageTemplate,
        input.seoTitle,
        input.seoDescription,
        JSON.stringify(input.labels),
      ],
    );
  }

  async upsertBanner(
    scope: CatalogScope,
    input: NormalizedMerchantBannerInput,
  ): Promise<string> {
    assertCatalogAdminScope(scope);

    if (!input.id) {
      const rows = await this.sql.query(
        `insert into public.catalog_banners (
          tenant_id,
          store_id,
          object_key,
          title,
          subtitle,
          link_url,
          active,
          position,
          updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,now())
        returning id`,
        [
          scope.tenantId,
          scope.storeId,
          input.objectKey,
          input.title,
          input.subtitle,
          input.linkUrl,
          input.active,
          input.position,
        ],
      );
      return idFrom(rows, "Banner");
    }

    const rows = await this.sql.query(
      `update public.catalog_banners
          set object_key = $4,
              title = $5,
              subtitle = $6,
              link_url = $7,
              active = $8,
              position = $9,
              updated_at = now()
        where tenant_id = $1
          and store_id = $2
          and id = $3
      returning id`,
      [
        scope.tenantId,
        scope.storeId,
        input.id,
        input.objectKey,
        input.title,
        input.subtitle,
        input.linkUrl,
        input.active,
        input.position,
      ],
    );
    return idFrom(rows, "Banner");
  }

  async deleteBanner(scope: CatalogScope, bannerId: string): Promise<void> {
    assertCatalogAdminScope(scope);
    const rows = await this.sql.query(
      `delete from public.catalog_banners
        where tenant_id = $1
          and store_id = $2
          and id = $3
      returning id`,
      [scope.tenantId, scope.storeId, bannerId],
    );
    idFrom(rows, "Banner");
  }
}
