import { useState } from "react";
import type { CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { CatalogSettings, Category, Product, PublicCatalogMerchandising, PublicStoreProfile, StorefrontStore } from "@white-label/catalog";
import { addCartItem, getCatalogAdvancedSettings, getCatalogBehavior } from "@white-label/catalog";
import { CartPanel } from "../features/storefront/cart-panel.tsx";
import { ProductCard } from "../features/storefront/product-card.tsx";
import { ProductDetail } from "../features/storefront/product-detail.tsx";
import { PromotionalBar } from "../features/storefront/promotional-bar.tsx";
import { storefrontAdvancedTheme } from "../features/storefront/storefront-advanced-theme.ts";
import { storefrontTheme } from "../features/storefront/storefront-theme.ts";
import { useStorefrontCart } from "../features/storefront/use-storefront-cart.ts";
import { getPublicProductPage } from "../lib/server/catalog.functions.ts";

interface ProductPageData {
  store: StorefrontStore; settings: CatalogSettings; categories: Category[]; product: Product;
  relatedProducts: Product[]; profile: PublicStoreProfile; merchandising: PublicCatalogMerchandising | null; canonicalUrl: string;
}

// @ts-expect-error -- TanStack gera o tipo desta nova rota durante o build.
export const Route = createFileRoute("/produto/$slug")({
  loader: ({ params }) => getPublicProductPage({ data: { slug: (params as unknown as { slug: string }).slug } }),
  head: ({ loaderData }) => {
    const data = loaderData as unknown as ProductPageData | undefined; const behavior = data ? getCatalogBehavior(data.settings) : null;
    const fallbackDescription = data?.settings.seoDescription ?? `Produto de ${data?.store.name ?? "loja"}`;
    return { meta: [{ title: data ? `${data.product.name} · ${data.store.name}` : "Produto" }, { name: "description", content: behavior?.showDescription ? data?.product.description ?? fallbackDescription : fallbackDescription }], links: data?.canonicalUrl ? [{ rel: "canonical", href: data.canonicalUrl }] : [] };
  },
  pendingComponent: () => <main className="sf-state"><div className="sf-state__skeleton" /><div className="sf-state__skeleton sf-state__skeleton--short" /></main>,
  errorComponent: () => <main className="sf-state"><h1>Produto não encontrado</h1><p>Este produto não está disponível nesta loja.</p><a href="/">Voltar para a loja</a></main>,
  component: PublicProductPage,
});

function PublicProductPage(): React.JSX.Element {
  const data = Route.useLoaderData() as unknown as ProductPageData; const behavior = getCatalogBehavior(data.settings); const advanced = getCatalogAdvancedSettings(data.settings); const cartEnabled = behavior.cartEnabled && behavior.showBuyButton && !behavior.catalogOnly;
  const [cart, setCart] = useStorefrontCart(data.store, cartEnabled, behavior.persistCart, behavior.quantityEnabled); const [cartOpen, setCartOpen] = useState(false); const category = data.categories.find((item) => item.id === data.product.categoryId);
  const theme = { "--sf-primary": data.settings.primaryColor, "--sf-accent": data.settings.accentColor, "--sf-bg": data.settings.backgroundColor, "--sf-font": data.settings.fontFamily === "serif" ? "Georgia,serif" : "Inter,system-ui,sans-serif" } as CSSProperties;
  const whatsappEnabled = behavior.showWhatsapp && cartEnabled && data.settings.checkoutMode !== "online" && Boolean(data.settings.whatsappPhone); const itemCount = cart.items.reduce((total, item) => total + item.quantity, 0);
  return <div className={`sf sf--${data.settings.layout}`} style={theme}><style>{storefrontTheme + storefrontAdvancedTheme}</style><PromotionalBar merchandising={data.merchandising} /><header className="sf__header"><div className="sf__header-inner"><a className="sf__logo" href="/">{data.store.name}</a><nav className="sf__nav"><a href="/">Produtos</a></nav>{cartEnabled ? <button className="sf__cart-button" type="button" onClick={() => { setCartOpen(true); }}><span>Carrinho</span><strong>{itemCount}</strong></button> : null}</div></header><main className="sf__main"><ProductDetail product={data.product} categoryName={category?.name ?? null} showPrice={data.settings.showPrice} showStock={data.settings.showStock} showDescription={behavior.showDescription} showSku={behavior.showSku} showBuyButton={behavior.showBuyButton && behavior.cartEnabled} quantityEnabled={behavior.quantityEnabled} catalogOnly={behavior.catalogOnly} showShare={behavior.showShare} shareUrl={data.canonicalUrl} mode="page" onAdd={(product, variantId, quantity) => { if (!cartEnabled) return; setCart((current) => addCartItem(current, product, variantId, quantity)); setCartOpen(true); }} />{behavior.showRelated && data.relatedProducts.length ? <section className="sf__products" aria-labelledby="sf-related-title"><div className="sf__section-head"><div><span className="sf__eyebrow">Você também pode gostar</span><h2 id="sf-related-title">Produtos relacionados</h2></div></div><div className={`sf__grid sf__grid--columns-${String(advanced.productsPerRow)}`}>{data.relatedProducts.map((product) => <ProductCard key={product.id} product={product} categoryName={category?.name ?? null} showPrice={data.settings.showPrice} showDescription={behavior.showDescription} showSku={behavior.showSku} cardStyle={advanced.cardStyle} />)}</div></section> : null}</main>{cartOpen && cartEnabled ? <CartPanel cart={cart} whatsappEnabled={whatsappEnabled} showPrice={data.settings.showPrice} quantityEnabled={behavior.quantityEnabled} checkoutSettings={advanced} onChange={setCart} onClose={() => { setCartOpen(false); }} /> : null}</div>;
}
