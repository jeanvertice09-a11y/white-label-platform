import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { CatalogPage, Category, Product, StorefrontSnapshot } from "@white-label/catalog";
import { addCartItem, createCart, getCatalogPublicMediaUrl } from "@white-label/catalog";
import { listPublicCatalogProducts } from "../../lib/server/catalog.functions.ts";
import { CartPanel } from "./cart-panel.tsx";
import { ProductCard } from "./product-card.tsx";
import { ProductDetail } from "./product-detail.tsx";
import { storefrontTheme } from "./storefront-theme.ts";

type Sort = "position" | "name" | "price_asc" | "price_desc";

function categoryName(categories: Category[], categoryId: string | null): string | null {
  if (!categoryId) return null;
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return null;
  const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function Toolbar(props: Readonly<{
  data: StorefrontSnapshot;
  search: string;
  categoryId: string;
  sort: Sort;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onSort: (value: Sort) => void;
}>): React.JSX.Element | null {
  if (!props.data.settings.showSearch && !props.data.settings.showCategories) return null;
  return <div className="sf__toolbar">
    {props.data.settings.showSearch ? <input className="sf__search" value={props.search} onChange={(event) => { props.onSearch(event.target.value); }} placeholder="Buscar produtos" aria-label="Buscar produtos" /> : null}
    {props.data.settings.showCategories ? <div className="sf__chips"><button className="sf__chip" data-active={!props.categoryId} type="button" onClick={() => { props.onCategory(""); }}>Todos</button>{props.data.categories.map((category) => <button className="sf__chip" data-active={props.categoryId === category.id} type="button" key={category.id} onClick={() => { props.onCategory(category.id); }}>{categoryName(props.data.categories, category.id)}</button>)}</div> : null}
    <select className="sf__select sf__sort" value={props.sort} onChange={(event) => { props.onSort(event.target.value as Sort); }} aria-label="Ordenar produtos">
      <option value="position">Destaques</option><option value="name">Nome</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option>
    </select>
  </div>;
}

function Pagination(props: Readonly<{ page: CatalogPage; loading: boolean; onPage: (page: number) => void }>): React.JSX.Element | null {
  const pages = Math.max(1, Math.ceil(props.page.total / props.page.pageSize));
  if (pages <= 1) return null;
  return <nav className="sf__pagination" aria-label="Paginação do catálogo">
    <button type="button" disabled={props.loading || props.page.page <= 1} onClick={() => { props.onPage(props.page.page - 1); }}>Anterior</button>
    <span>Página {props.page.page} de {pages}</span>
    <button type="button" disabled={props.loading || props.page.page >= pages} onClick={() => { props.onPage(props.page.page + 1); }}>Próxima</button>
  </nav>;
}

function Products(props: Readonly<{
  data: StorefrontSnapshot;
  page: CatalogPage;
  loading: boolean;
  error: string;
  onOpen: (product: Product) => void;
}>): React.JSX.Element {
  if (props.loading) return <div className="sf__empty">Carregando produtos…</div>;
  if (props.error) return <div className="sf__empty">{props.error}</div>;
  if (!props.page.items.length) return <div className="sf__empty">Nenhum produto encontrado.</div>;
  return <div className="sf__grid">{props.page.items.map((product) => <ProductCard key={product.id} product={product} categoryName={categoryName(props.data.categories, product.categoryId)} showPrice={props.data.settings.showPrice} onOpen={props.onOpen} />)}</div>;
}

export function StorefrontView({ data }: Readonly<{ data: StorefrontSnapshot }>): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState<Sort>("position");
  const [page, setPage] = useState(data.products);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [cart, setCart] = useState(() => createCart(data.store));
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const firstLoad = useRef(true);
  const theme = {
    "--sf-primary": data.settings.primaryColor,
    "--sf-accent": data.settings.accentColor,
    "--sf-bg": data.settings.backgroundColor,
    "--sf-font": data.settings.fontFamily === "serif" ? "Georgia,serif" : "system-ui,sans-serif",
  } as CSSProperties;
  const banner = data.banners.at(0);
  const whatsappEnabled = data.settings.checkoutMode !== "online" && Boolean(data.settings.whatsappPhone);

  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return; }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setLoadError("");
      void listPublicCatalogProducts({ data: {
        page: page.page,
        pageSize: 12,
        search: search.trim() || undefined,
        categoryId: categoryId || undefined,
        sort,
      } }).then((next) => { if (active) setPage(next); }).catch(() => { if (active) setLoadError("Não foi possível atualizar os produtos."); }).finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, categoryId, sort, page.page]);

  function resetPage(update: () => void): void {
    setPage((current) => ({ ...current, page: 1 }));
    update();
  }

  function add(product: Product, variantId: string | null, quantity: number): void {
    setCart((current) => addCartItem(current, product, variantId, quantity));
    setSelected(null);
    setCartOpen(true);
  }

  return <div className={`sf sf--${data.settings.layout}`} style={theme}>
    <style>{storefrontTheme}</style>
    <header className="sf__hero">
      <div className="sf__brand"><div><h1>{data.store.name}</h1><p>{data.settings.labels["subtitle"] ?? "Catálogo online"}</p></div><button className="sf__cart-button" type="button" onClick={() => { setCartOpen(true); }}>Carrinho · {cart.items.reduce((total, item) => total + item.quantity, 0)}</button></div>
      {banner ? <a className="sf__banner" href={banner.href ?? undefined}><img src={getCatalogPublicMediaUrl(banner, banner.imageObjectKey)} alt={banner.altText ?? banner.title ?? data.store.name} /></a> : null}
    </header>
    <Toolbar data={data} search={search} categoryId={categoryId} sort={sort} onSearch={(value) => { resetPage(() => { setSearch(value); }); }} onCategory={(value) => { resetPage(() => { setCategoryId(value); }); }} onSort={(value) => { resetPage(() => { setSort(value); }); }} />
    <Products data={data} page={page} loading={loading} error={loadError} onOpen={setSelected} />
    <Pagination page={page} loading={loading} onPage={(next) => { setPage((current) => ({ ...current, page: next })); }} />
    {selected ? <ProductDetail product={selected} categoryName={categoryName(data.categories, selected.categoryId)} showPrice={data.settings.showPrice} showStock={data.settings.showStock} onClose={() => { setSelected(null); }} onAdd={add} /> : null}
    {cartOpen ? <CartPanel cart={cart} whatsappEnabled={whatsappEnabled} onChange={setCart} onClose={() => { setCartOpen(false); }} /> : null}
  </div>;
}
