import { useState } from "react";
import type { CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { addCartItem, createCart } from "@white-label/catalog";
import { CartPanel } from "../features/storefront/cart-panel.tsx";
import { ProductDetail } from "../features/storefront/product-detail.tsx";
import { storefrontTheme } from "../features/storefront/storefront-theme.ts";
import { getPublicProductPage } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/produto/$slug" as never)({
  loader: ({ params }) => getPublicProductPage({ data: { slug: (params as { slug: string }).slug } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.product.name} · ${loaderData.store.name}` : "Produto" },
      { name: "description", content: loaderData?.product.description ?? `Produto de ${loaderData?.store.name ?? "loja"}` },
    ],
    links: loaderData?.canonicalUrl ? [{ rel: "canonical", href: loaderData.canonicalUrl }] : [],
  }),
  pendingComponent: () => <main className="sf-state"><div className="sf-state__skeleton" /><div className="sf-state__skeleton sf-state__skeleton--short" /></main>,
  errorComponent: () => <main className="sf-state"><h1>Produto não encontrado</h1><p>Este produto não está disponível nesta loja.</p><a href="/">Voltar para a loja</a></main>,
  component: PublicProductPage,
});

function PublicProductPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  const [cart, setCart] = useState(() => createCart(data.store));
  const [cartOpen, setCartOpen] = useState(false);
  const category = data.categories.find((item) => item.id === data.product.categoryId);
  const theme = {
    "--sf-primary": data.settings.primaryColor,
    "--sf-accent": data.settings.accentColor,
    "--sf-bg": data.settings.backgroundColor,
    "--sf-font": data.settings.fontFamily === "serif" ? "Georgia,serif" : "Inter,system-ui,sans-serif",
  } as CSSProperties;
  const whatsappEnabled = data.settings.checkoutMode !== "online" && Boolean(data.settings.whatsappPhone);
  const itemCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  return <div className="sf" style={theme}>
    <style>{storefrontTheme}</style>
    <header className="sf__header"><div className="sf__header-inner"><a className="sf__logo" href="/">{data.store.name}</a><nav className="sf__nav"><a href="/">Produtos</a></nav><button className="sf__cart-button" type="button" onClick={() => { setCartOpen(true); }}><span>Carrinho</span><strong>{itemCount}</strong></button></div></header>
    <ProductDetail
      product={data.product}
      categoryName={category?.name ?? null}
      showPrice={data.settings.showPrice}
      showStock={data.settings.showStock}
      mode="page"
      onAdd={(product, variantId, quantity) => {
        setCart((current) => addCartItem(current, product, variantId, quantity));
        setCartOpen(true);
      }}
    />
    {cartOpen ? <CartPanel cart={cart} whatsappEnabled={whatsappEnabled} onChange={setCart} onClose={() => { setCartOpen(false); }} /> : null}
  </div>;
}
