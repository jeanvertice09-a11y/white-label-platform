import type { CSSProperties } from "react";
import { useState } from "react";
import {
  buildCatalogMediaUrl,
  getCartItemCount,
} from "@white-label/catalog";
import type { CatalogCart } from "@white-label/catalog";
import {
  addProductPayloadToCart,
  initialCatalogCart,
  useCatalogListing,
  useProductSelection,
} from "./catalog-hooks.ts";
import {
  CatalogFilters,
  CatalogHeader,
  CatalogPagination,
  CatalogProductGrid,
  CategoryChips,
} from "./catalog-listing.tsx";
import { CatalogProductDetail } from "./product-detail.tsx";
import { CatalogCartPanel } from "./cart-panel.tsx";
import type { PublicCatalogPayload } from "./view-model.ts";

type ListingState = ReturnType<typeof useCatalogListing>;
type ProductState = ReturnType<typeof useProductSelection>;

export function PublicCatalogPage(props: {
  initial: PublicCatalogPayload;
}): React.JSX.Element {
  const listing = useCatalogListing(props.initial);
  const product = useProductSelection();
  const [cart, setCart] = useState<CatalogCart>(() => initialCatalogCart(props.initial));
  const settings = listing.payload.catalog.settings;

  function addSelected(): void {
    if (product.selected === null) return;
    setCart(
      addProductPayloadToCart(cart, product.selected, product.selectedVariantId),
    );
    product.closeProduct();
  }

  return (
    <section
      className={`catalog-shell catalog-layout-${settings.layout}`}
      style={catalogStyle(settings)}
    >
      <CatalogHeader
        storeName={listing.payload.store.name}
        subtitle={settings.labels["catalogSubtitle"] ?? "Catálogo"}
        itemCount={getCartItemCount(cart)}
      />
      <CatalogBanner payload={listing.payload} />
      <CatalogMain
        listing={listing}
        product={product}
        onAddSelected={addSelected}
      />
      <CatalogCartPanel
        storeName={listing.payload.store.name}
        cart={cart}
        settings={settings}
        onCartChange={setCart}
      />
    </section>
  );
}

function CatalogMain(props: {
  listing: ListingState;
  product: ProductState;
  onAddSelected: () => void;
}): React.JSX.Element {
  const { listing, product } = props;
  const settings = listing.payload.catalog.settings;
  const products = listing.payload.catalog.products;

  return (
    <>
      <CatalogFilters
        query={listing.query}
        searchText={listing.searchText}
        showSearch={settings.showSearch}
        loading={listing.loading}
        onSearchText={listing.setSearchText}
        onReload={listing.reload}
      />
      <CategorySection listing={listing} />
      <CatalogProductGrid
        products={products.items}
        mediaBaseUrl={listing.payload.mediaBaseUrl}
        showPrices={settings.showPrices}
        onOpen={product.openProduct}
      />
      <CatalogPagination
        page={products.page}
        totalPages={products.totalPages}
        loading={listing.loading}
        query={listing.query}
        onReload={listing.reload}
      />
      {product.detailLoading ? <LoadingProduct /> : null}
      <SelectedProduct
        product={product}
        onAddSelected={props.onAddSelected}
      />
    </>
  );
}

function CategorySection({ listing }: { listing: ListingState }): React.JSX.Element | null {
  const categories = listing.payload.catalog.categories;
  if (!listing.payload.catalog.settings.showCategories || categories.length === 0) {
    return null;
  }

  return (
    <CategoryChips
      categories={categories}
      query={listing.query}
      onReload={listing.reload}
    />
  );
}

function SelectedProduct(props: {
  product: ProductState;
  onAddSelected: () => void;
}): React.JSX.Element | null {
  if (props.product.selected === null) return null;

  return (
    <CatalogProductDetail
      payload={props.product.selected}
      selectedVariantId={props.product.selectedVariantId}
      onVariantChange={props.product.setSelectedVariantId}
      onAdd={props.onAddSelected}
      onClose={props.product.closeProduct}
    />
  );
}

function catalogStyle(settings: PublicCatalogPayload["catalog"]["settings"]): CSSProperties {
  const fonts: Record<string, string> = {
    system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    inter: "Inter, system-ui, sans-serif",
    manrope: "Manrope, system-ui, sans-serif",
    poppins: "Poppins, system-ui, sans-serif",
    montserrat: "Montserrat, system-ui, sans-serif",
    playfair: "'Playfair Display', Georgia, serif",
  };
  return {
    "--catalog-primary": settings.primaryColor,
    "--catalog-accent": settings.accentColor,
    "--catalog-bg": settings.backgroundColor,
    fontFamily: fonts[settings.fontKey],
  } as CSSProperties;
}

function CatalogBanner(props: {
  payload: PublicCatalogPayload;
}): React.JSX.Element | null {
  const banners = props.payload.catalog.banners;
  if (banners.length === 0) return null;
  const banner = banners[0];
  const url = buildCatalogMediaUrl(props.payload.mediaBaseUrl, banner.objectKey);
  if (url === null) return null;

  return (
    <a href={banner.linkUrl ?? "#produtos"} style={{ display: "block", marginBottom: 24 }}>
      <img
        src={url}
        alt={banner.title ?? "Banner da loja"}
        style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 20 }}
      />
    </a>
  );
}

function LoadingProduct(): React.JSX.Element {
  return (
    <div className="catalog-empty" style={{ marginTop: 24 }}>
      Carregando produto...
    </div>
  );
}
