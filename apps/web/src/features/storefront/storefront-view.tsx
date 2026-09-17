import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CartState, Product, StorefrontSnapshot } from "@white-label/catalog";
import {
  addCartItem,
  createCart,
  getCatalogPublicMediaUrl,
} from "@white-label/catalog";
import { CartPanel } from "./cart-panel.tsx";
import { ProductCard } from "./product-card.tsx";
import { ProductDetail } from "./product-detail.tsx";
import { storefrontTheme } from "./storefront-theme.ts";

function fontValue(font: StorefrontSnapshot["settings"]["fontFamily"]): string {
  if (font === "serif") return "Georgia, serif";
  if (font === "inter") return "Inter, system-ui, sans-serif";
  if (font === "sans") return "Arial, sans-serif";
  return "system-ui, sans-serif";
}

function Banner(props: Readonly<{ data: StorefrontSnapshot }>): React.JSX.Element | null {
  const banner = props.data.banners.at(0);
  if (!banner) return null;
  const url = getCatalogPublicMediaUrl(banner, banner.imageObjectKey);
  const image = <img src={url} alt={banner.altText ?? banner.title ?? ""} />;
  return (
    <div className="sf__banner">
      {banner.href ? <a href={banner.href}>{image}</a> : image}
    </div>
  );
}

function Toolbar(props: Readonly<{
  data: StorefrontSnapshot;
  search: string;
  categoryId: string;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
}>): React.JSX.Element {
  return (
    <div className="sf__toolbar">
      {props.data.settings.showSearch ? (
        <input className="sf__search" value={props.search} onChange={(event) => { props.onSearch(event.target.value); }} placeholder="Buscar produtos…" aria-label="Buscar produtos" />
      ) : null}
      {props.data.settings.showCategories ? (
        <div className="sf__chips">
          <button className="sf__chip" data-active={!props.categoryId} type="button" onClick={() => { props.onCategory(""); }}>Todos</button>
          {props.data.categories.map((category) => (
            <button key={category.id} className="sf__chip" data-active={props.categoryId === category.id} type="button" onClick={() => { props.onCategory(category.id); }}>{category.name}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductGrid(props: Readonly<{
  products: Product[];
  showPrice: boolean;
  onOpen: (product: Product) => void;
}>): React.JSX.Element {
  if (!props.products.length) return <div className="sf__empty">Nenhum produto encontrado.</div>;
  return (
    <div className="sf__grid">
      {props.products.map((product) => <ProductCard key={product.id} product={product} showPrice={props.showPrice} onOpen={props.onOpen} />)}
    </div>
  );
}

export function StorefrontView({ data }: Readonly<{ data: StorefrontSnapshot }>): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartState>(() => createCart(data.store));
  const [cartOpen, setCartOpen] = useState(false);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return data.products.items.filter((product) => {
      const matchesSearch = !term || product.name.toLocaleLowerCase("pt-BR").includes(term) || (product.sku ?? "").toLocaleLowerCase("pt-BR").includes(term);
      return matchesSearch && (!categoryId || product.categoryId === categoryId);
    });
  }, [categoryId, data.products.items, search]);
  const count = cart.items.reduce((total, item) => total + item.quantity, 0);
  const style = {
    "--sf-primary": data.settings.primaryColor,
    "--sf-accent": data.settings.accentColor,
    "--sf-bg": data.settings.backgroundColor,
    "--sf-font": fontValue(data.settings.fontFamily),
  } as CSSProperties;
  const phone = data.settings.checkoutMode === "online" ? null : data.settings.whatsappPhone;

  function add(product: Product, variantId: string | null): void {
    setCart((current) => addCartItem(current, product, variantId, 1));
    setSelected(null);
    setCartOpen(true);
  }

  return (
    <section className={"sf sf--" + data.settings.layout} style={style}>
      <style>{storefrontTheme}</style>
      <div className="sf__hero">
        <div className="sf__brand"><div><h1>{data.store.name}</h1><p>{data.settings.seoDescription ?? "Confira nossos produtos."}</p></div>
          <button className="sf__cart-button" type="button" onClick={() => { setCartOpen(true); }}>Carrinho ({String(count)})</button>
        </div>
        <Banner data={data} />
      </div>
      <Toolbar data={data} search={search} categoryId={categoryId} onSearch={setSearch} onCategory={setCategoryId} />
      <ProductGrid products={filtered} showPrice={data.settings.showPrice} onOpen={setSelected} />
      {selected ? <ProductDetail product={selected} showPrice={data.settings.showPrice} showStock={data.settings.showStock} onClose={() => { setSelected(null); }} onAdd={add} /> : null}
      {cartOpen ? <CartPanel cart={cart} phone={phone} intro={data.settings.whatsappMessage} onChange={setCart} onClose={() => { setCartOpen(false); }} /> : null}
    </section>
  );
}
