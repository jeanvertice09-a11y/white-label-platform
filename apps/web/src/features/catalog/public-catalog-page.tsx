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

export function PublicCatalogPage(props: {
  initial: PublicCatalogPayload;
}): React.JSX.Element {
  const listing = useCatalogListing(props.initial);
  const product = useProductSelection();
  const [cart, setCart] = useState<CatalogCart>(() => initialCatalogCart(props.initial));
  const settings = listing.payload.catalog.settings;
  const products = listing.payload.catalog.products;

  function addSelected(): void {
    if (!product.selected) return;
    setCart(
      addProductPayloadToCart(
        cart,
        product.selected,
        product.selectedVariantId,
      ),
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
      <CatalogFilters
        query={listing.query}
        searchText={listing.searchText}
        showSearch={settings.showSearch}
        loading={listing.loading}
        onSearchText={listing.setSearchText}
        onReload={listing.reload}
      />
      {settings.showCategories && listing.payload.catalog.categories.length > 0 ? (
        <CategoryChips
          categories={listing.payload.catalog.categories}
          query={listing.query}
          onReload={listing.reload}
        />
      ) : null}
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
      {product.selected ? (
        <CatalogProductDetail
          payload={product.selected}
          selectedVariantId={product.selectedVariantId}
          onVariantChange={product.setSelectedVariantId}
          onAdd={addSelected}
          onClose={product.closeProduct}
        />
      ) : null}
      <CatalogCartPanel
        storeName={listing.payload.store.name}
        cart={cart}
        settings={settings}
        onCartChange={setCart}
      />
    </section>
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
    fontFamily: fonts[settings.fontKey] ?? fonts["system"],
  } as CSSProperties;
}

function CatalogBanner(props: {
  payload: PublicCatalogPayload;
}): React.JSX.Element | null {
  const banner = props.payload.catalog.banners[0];
  const url = buildCatalogMediaUrl(props.payload.mediaBaseUrl, banner?.objectKey);
  if (!banner || !url) return null;

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
