export type {
  CatalogListInput,
  CatalogPage,
  CatalogQuery,
  CatalogScope,
  CatalogSort,
  Category,
  NormalizedCatalogListInput,
  Product,
  PublicCatalogSnapshot,
} from "./types.ts";
export {
  assertCatalogScope,
  normalizeCatalogListInput,
} from "./types.ts";

export type {
  CatalogBanner,
  CatalogFontKey,
  CatalogLayout,
  CatalogProductDetail,
  CatalogSettings,
  CheckoutMode,
  ProductImage,
  PublicStorefrontSnapshot,
} from "./storefront.ts";
export {
  DEFAULT_CATALOG_SETTINGS,
  defaultCatalogSettings,
  isOnlineCheckoutEnabled,
  isWhatsappCheckoutEnabled,
} from "./storefront.ts";

export type {
  CatalogListResult,
  CatalogRepository,
} from "./repository.ts";

export {
  PostgresCatalogRepository,
} from "./postgres.ts";
export type {
  CatalogSqlExecutor,
} from "./postgres.ts";

export {
  CatalogProductNotFoundError,
  CatalogUnavailableError,
  loadPublicCatalog,
  loadPublicProduct,
  loadPublicProductDetail,
} from "./service.ts";

export type {
  ProductVariant,
} from "./pricing.ts";
export {
  CatalogSelectionError,
  calculateCartLineTotal,
  resolveCatalogUnitPrice,
} from "./pricing.ts";

export type {
  AddToCartInput,
  CatalogCart,
  CatalogCartLine,
} from "./cart.ts";
export {
  addItemToCart,
  createEmptyCart,
  getCartItemCount,
  getCartTotalCents,
  removeCartItem,
  setCartItemQuantity,
} from "./cart.ts";

export type {
  WhatsappCheckoutInput,
} from "./whatsapp.ts";
export {
  buildWhatsappCheckoutUrl,
  buildWhatsappOrderMessage,
} from "./whatsapp.ts";

export type {
  CatalogAdminRepository,
  MerchantBannerInput,
  MerchantCatalogSettingsInput,
  MerchantCategoryInput,
  MerchantProductInput,
  MerchantVariantInput,
  NormalizedMerchantBannerInput,
  NormalizedMerchantCatalogSettingsInput,
  NormalizedMerchantCategoryInput,
  NormalizedMerchantProductInput,
  NormalizedMerchantVariantInput,
} from "./admin.ts";
export {
  assertCatalogAdminScope,
  normalizeMerchantBannerInput,
  normalizeMerchantCatalogSettingsInput,
  normalizeMerchantCategoryInput,
  normalizeMerchantProductInput,
  normalizeMerchantVariantInput,
  slugifyCatalogName,
} from "./admin.ts";

export {
  PostgresCatalogAdminRepository,
} from "./postgres-admin.ts";
export type {
  CatalogAdminSqlExecutor,
} from "./postgres-admin.ts";
