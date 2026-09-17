import type {
  BannerMutationInput,
  CatalogSettingsMutationInput,
  CategoryMutationInput,
  ProductMutationInput,
  VariantMutationInput,
} from "./admin-types.ts";
import type {
  CatalogScope,
  CatalogSettings,
  Category,
  Product,
  ProductVariant,
  StoreBanner,
} from "./types.ts";

export interface CatalogAdminRepository {
  createProduct(scope: CatalogScope, input: ProductMutationInput): Promise<Product>;
  updateProduct(scope: CatalogScope, id: string, input: ProductMutationInput): Promise<Product | null>;
  createVariant(scope: CatalogScope, input: VariantMutationInput): Promise<ProductVariant>;
  updateVariant(
    scope: CatalogScope,
    id: string,
    input: VariantMutationInput,
  ): Promise<ProductVariant | null>;
  createCategory(scope: CatalogScope, input: CategoryMutationInput): Promise<Category>;
  updateCategory(
    scope: CatalogScope,
    id: string,
    input: CategoryMutationInput,
  ): Promise<Category | null>;
  createBanner(scope: CatalogScope, input: BannerMutationInput): Promise<StoreBanner>;
  updateBanner(
    scope: CatalogScope,
    id: string,
    input: BannerMutationInput,
  ): Promise<StoreBanner | null>;
  updateSettings(
    scope: CatalogScope,
    input: CatalogSettingsMutationInput,
  ): Promise<CatalogSettings>;
}
