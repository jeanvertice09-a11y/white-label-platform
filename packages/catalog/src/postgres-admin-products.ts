import type { CatalogScope } from "./types.ts";
import type {
  NormalizedMerchantProductInput,
  NormalizedMerchantVariantInput,
} from "./admin.ts";
import type { CatalogAdminSqlExecutor } from "./postgres-admin.ts";
import type { CatalogSqlExecutor } from "./postgres.ts";

function idFrom(rows: Record<string, unknown>[], resource: string): string {
  const value = rows[0]?.["id"];
  if (typeof value !== "string" || !value) {
    throw new Error(`${resource} não encontrado`);
  }
  return value;
}

export async function createProduct(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  input: NormalizedMerchantProductInput,
): Promise<string> {
  const rows = await sql.query(
    `insert into public.products (
      tenant_id, store_id, category_id, slug, name, description, sku,
      price_cents, compare_at_price_cents, cost_cents, active,
      track_inventory, updated_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
    returning id`,
    [
      scope.tenantId, scope.storeId, input.categoryId, input.slug, input.name,
      input.description, input.sku, input.priceCents, input.compareAtPriceCents,
      input.costCents, input.active, input.trackInventory,
    ],
  );
  return idFrom(rows, "Produto");
}

export async function updateProduct(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  productId: string,
  input: NormalizedMerchantProductInput,
): Promise<void> {
  const rows = await sql.query(
    `update public.products
        set category_id = $4, slug = $5, name = $6, description = $7,
            sku = $8, price_cents = $9, compare_at_price_cents = $10,
            cost_cents = $11, active = $12, track_inventory = $13,
            updated_at = now()
      where tenant_id = $1 and store_id = $2 and id = $3
    returning id`,
    [
      scope.tenantId, scope.storeId, productId, input.categoryId, input.slug,
      input.name, input.description, input.sku, input.priceCents,
      input.compareAtPriceCents, input.costCents, input.active,
      input.trackInventory,
    ],
  );
  idFrom(rows, "Produto");
}

export async function setProductActive(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  productId: string,
  active: boolean,
): Promise<void> {
  const rows = await sql.query(
    `update public.products
        set active = $4, updated_at = now()
      where tenant_id = $1 and store_id = $2 and id = $3
    returning id`,
    [scope.tenantId, scope.storeId, productId, active],
  );
  idFrom(rows, "Produto");
}

export async function replaceProductVariants(
  sql: CatalogAdminSqlExecutor,
  scope: CatalogScope,
  productId: string,
  variants: NormalizedMerchantVariantInput[],
): Promise<void> {
  await sql.transaction(async (tx) => {
    await assertProductExists(tx, scope, productId);
    await tx.query(
      `delete from public.product_variants
        where tenant_id = $1 and store_id = $2 and product_id = $3`,
      [scope.tenantId, scope.storeId, productId],
    );
    for (const variant of variants) {
      await insertVariant(tx, scope, productId, variant);
    }
  });
}

async function assertProductExists(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  productId: string,
): Promise<void> {
  const rows = await sql.query(
    `select id from public.products
      where tenant_id = $1 and store_id = $2 and id = $3
      for update`,
    [scope.tenantId, scope.storeId, productId],
  );
  idFrom(rows, "Produto");
}

async function insertVariant(
  sql: CatalogSqlExecutor,
  scope: CatalogScope,
  productId: string,
  variant: NormalizedMerchantVariantInput,
): Promise<void> {
  await sql.query(
    `insert into public.product_variants (
      id, tenant_id, store_id, product_id, name, sku, attributes,
      price_cents, compare_at_price_cents, cost_cents, active,
      position, updated_at
    ) values (
      coalesce($4::uuid, gen_random_uuid()),
      $1,$2,$3,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,now()
    )`,
    [
      scope.tenantId, scope.storeId, productId, variant.id ?? null,
      variant.name, variant.sku, JSON.stringify(variant.attributes),
      variant.priceCents, variant.compareAtPriceCents, variant.costCents,
      variant.active, variant.position,
    ],
  );
}
