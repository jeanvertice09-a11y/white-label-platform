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
import { assertCatalogAdminScope } from "./admin-validation.ts";
import { loadMerchantCatalogAdminSnapshot } from "./postgres-admin-snapshot.ts";
import {
  createProduct as createProductRow,
  replaceProductVariants as replaceVariantsRows,
  setProductActive as setProductActiveRow,
  updateProduct as updateProductRow,
} from "./postgres-admin-products.ts";
import {
  createCategory as createCategoryRow,
  deleteBanner as deleteBannerRow,
  updateCategory as updateCategoryRow,
  upsertBanner as upsertBannerRow,
  upsertSettings as upsertSettingsRow,
} from "./postgres-admin-storefront.ts";

export interface CatalogAdminSqlExecutor extends CatalogSqlExecutor {
  transaction<T>(run: (tx: CatalogSqlExecutor) => Promise<T>): Promise<T>;
}

export class PostgresCatalogAdminRepository implements CatalogAdminRepository {
  constructor(private readonly sql: CatalogAdminSqlExecutor) {}

  async getSnapshot(scope: CatalogScope): Promise<MerchantCatalogAdminSnapshot> {
    assertCatalogAdminScope(scope);
    return loadMerchantCatalogAdminSnapshot(this.sql, scope);
  }

  async createProduct(
    scope: CatalogScope,
    input: NormalizedMerchantProductInput,
  ): Promise<string> {
    assertCatalogAdminScope(scope);
    return createProductRow(this.sql, scope, input);
  }

  async updateProduct(
    scope: CatalogScope,
    productId: string,
    input: NormalizedMerchantProductInput,
  ): Promise<void> {
    assertCatalogAdminScope(scope);
    await updateProductRow(this.sql, scope, productId, input);
  }

  async setProductActive(
    scope: CatalogScope,
    productId: string,
    active: boolean,
  ): Promise<void> {
    assertCatalogAdminScope(scope);
    await setProductActiveRow(this.sql, scope, productId, active);
  }

  async replaceProductVariants(
    scope: CatalogScope,
    productId: string,
    variants: NormalizedMerchantVariantInput[],
  ): Promise<void> {
    assertCatalogAdminScope(scope);
    await replaceVariantsRows(this.sql, scope, productId, variants);
  }

  async createCategory(
    scope: CatalogScope,
    input: NormalizedMerchantCategoryInput,
  ): Promise<string> {
    assertCatalogAdminScope(scope);
    return createCategoryRow(this.sql, scope, input);
  }

  async updateCategory(
    scope: CatalogScope,
    categoryId: string,
    input: NormalizedMerchantCategoryInput,
  ): Promise<void> {
    assertCatalogAdminScope(scope);
    await updateCategoryRow(this.sql, scope, categoryId, input);
  }

  async upsertSettings(
    scope: CatalogScope,
    input: NormalizedMerchantCatalogSettingsInput,
  ): Promise<void> {
    assertCatalogAdminScope(scope);
    await upsertSettingsRow(this.sql, scope, input);
  }

  async upsertBanner(
    scope: CatalogScope,
    input: NormalizedMerchantBannerInput,
  ): Promise<string> {
    assertCatalogAdminScope(scope);
    return upsertBannerRow(this.sql, scope, input);
  }

  async deleteBanner(scope: CatalogScope, bannerId: string): Promise<void> {
    assertCatalogAdminScope(scope);
    await deleteBannerRow(this.sql, scope, bannerId);
  }
}
