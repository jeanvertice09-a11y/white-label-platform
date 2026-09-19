import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { CatalogPage, Category, StorefrontSnapshot } from "@white-label/catalog";
import { createCart, getCatalogPublicMediaUrl } from "@white-label/catalog";
import { listPublicCatalogProducts } from "../../lib/server/catalog.functions.ts";
import { storefrontCategoryPath } from "../../lib/storefront-paths.ts";
import { CartPanel } from "./cart-panel.tsx";
import { ProductCard } from "./product-card.tsx";
import { storefrontTheme } from "./storefront-theme.ts";

type Sort = "position" | "name" | "price_asc" | "price_desc";

function categoryName(categories: Category[], categoryId: string | null): string | null {
  if (!categoryId) return null;
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return null;
  const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function StoreHeader(props: Readonly<{
  data: StorefrontSnapshot;
  itemCount: number;
  onCart: () => void;
}>): React.JSX.Element {
  return <header className="sf__header">
    <div className="sf__header-inner">
      <a className="sf__logo" href="/">{props.data.store.name}</a>
      <nav className="sf__nav" aria-label="Navegação da loja">
        {props.data.settings.showCategories ? <a href="#categorias">Categorias</a> : null}
        <a href="#produtos">Produtos</a>
      </nav>
      <button className="sf__cart-button" type="button" onClick={props.onCart} aria-label={`Abrir carrinho com ${String(props.itemCount)} item(ns)`}>
        <span>Carrinho</span><strong>{props.itemCount}</strong>
      </button>
    </div>
  </header>;
}

function Categories(props: Readonly<{ categories: Category[]; activeId: string }>): React.JSX.Element | null {
  if (!props.categories.length) return null;
  return <section className="sf__categories" id="categorias" aria-labelledby="sf-categories-title">
    <div className="sf__section-head"><div><span className="sf__eyebrow">Navegue</span><h2 id="sf-categories-title">Categorias</h2></div></div>
    <div className="sf__category-list">
      <a className={!props.activeId ? "is-active" : ""} href="/">Todos os produtos</a>
      {props.categories.map((category) => <a className={props.activeId === category.id ? "is-active" : ""} key={category.id} href={storefrontCategoryPath(category.slug)}>
        {categoryName(props.categories, category.id)}
      </a>)}
    </div>
  </section>;
}

function Toolbar(props: Readonly<{
  data: StorefrontSnapshot;
  search: string;
  sort: Sort;
  onSearch: (value: string) => void;
  onSort: (value: Sort) => void;
}>): React.JSX.Element {
  return <div className="sf__toolbar">
    {props.data.settings.showSearch ? <label className="sf__search-wrap"><span className="sr-only">Buscar produtos</span><input className="sf__search" value={props.search} onChange={(event) => { props.onSearch(event.target.value); }} placeholder="Buscar na loja" aria-label="Buscar produtos" /></label> : <span />}
    <select className="sf__select sf__sort" value={props.sort} onChange={(event) => { props.onSort(event.target.value as Sort); }} aria-label="Ordenar produtos">
      <option value="position">Destaques</option><option value="name">Nome</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option>
    </select>
  </div>;
}

function Pagination(props: Readonly<{ page: CatalogPage; loading: boolean; onPage: (page: number) => void }>): React.JSX.Element | null {
  const pages = Math.max(1, Math.ceil(props.page.total / props.page.pageSize));
  if (pages <= 1) return null;
  return <nav className="sf__pagination" aria-label="Paginação dos produtos">
    <button type="button" disabled={props.loading || props.page.page <= 1} onClick={() => { props.onPage(props.page.page - 1); }}>Anterior</button>
    <span>{props.page.page} de {pages}</span>
    <button type="button" disabled={props.loading || props.page.page >= pages} onClick={() => { props.onPage(props.page.page + 1); }}>Próxima</button>
  </nav>;
}

function Products(props: Readonly<{ data: StorefrontSnapshot; page: CatalogPage; loading: boolean; error: string }>): React.JSX.Element {
  if (props.loading) return <div className="sf__grid" aria-busy="true">{Array.from({ length: 8 }, (_, index) => <div className="sf__product-skeleton" key={index}><span /><i /><i /></div>)}</div>;
  if (props.error) return <div className="sf__empty"><strong>Não foi possível atualizar os produtos</strong><span>{props.error}</span></div>;
  if (!props.page.items.length) return <div className="sf__empty"><strong>Nenhum produto encontrado</strong><span>Tente outro termo ou volte para todos os produtos.</span></div>;
  return <div className="sf__grid">{props.page.items.map((product) => <ProductCard key={product.id} product={product} categoryName={categoryName(props.data.categories, product.categoryId)} showPrice={props.data.settings.showPrice} />)}</div>;
}

export function StorefrontView(props: Readonly<{ data: StorefrontSnapshot; initialCategoryId?: string; pageTitle?: string }>): React.JSX.Element {
  const { data } = props;
  const initialCategoryId = props.initialCategoryId ?? "";
  const [search, setSearch] = useState("");
  const [categoryId] = useState(initialCategoryId);
  const [sort, setSort] = useState<Sort>("position");
  const [page, setPage] = useState(data.products);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [cart, setCart] = useState(() => createCart(data.store));
  const [cartOpen, setCartOpen] = useState(false);
  const firstLoad = useRef(true);
  const theme = {
    "--sf-primary": data.settings.primaryColor,
    "--sf-accent": data.settings.accentColor,
    "--sf-bg": data.settings.backgroundColor,
    "--sf-font": data.settings.fontFamily === "serif" ? "Georgia,serif" : "Inter,system-ui,sans-serif",
  } as CSSProperties;
  const banner = data.banners.at(0);
  const whatsappEnabled = data.settings.checkoutMode !== "online" && Boolean(data.settings.whatsappPhone);
  const itemCount = cart.items.reduce((total, item) => total + item.quantity, 0);

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
      } }).then((next) => { if (active) setPage(next); }).catch(() => { if (active) setLoadError("Tente novamente."); }).finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, categoryId, sort, page.page]);

  function resetPage(update: () => void): void {
    setPage((current) => ({ ...current, page: 1 }));
    update();
  }

  return <div className={`sf sf--${data.settings.layout}`} style={theme}>
    <style>{storefrontTheme}</style>
    <StoreHeader data={data} itemCount={itemCount} onCart={() => { setCartOpen(true); }} />
    <main className="sf__main">
      {banner ? <a className="sf__banner" href={banner.href ?? undefined}><img src={getCatalogPublicMediaUrl(banner, banner.imageObjectKey)} alt={banner.altText ?? banner.title ?? data.store.name} /></a> : null}
      <section className="sf__intro">
        <span className="sf__eyebrow">{props.pageTitle ? "Categoria" : "Loja online"}</span>
        <h1>{props.pageTitle ?? data.store.name}</h1>
        {!props.pageTitle && data.settings.labels["subtitle"] ? <p>{data.settings.labels["subtitle"]}</p> : null}
      </section>
      {data.settings.showCategories ? <Categories categories={data.categories} activeId={categoryId} /> : null}
      <section className="sf__products" id="produtos" aria-labelledby="sf-products-title">
        <div className="sf__section-head"><div><span className="sf__eyebrow">Catálogo</span><h2 id="sf-products-title">{props.pageTitle ? `Produtos em ${props.pageTitle}` : "Produtos"}</h2><p>{page.total} item(ns) encontrado(s)</p></div></div>
        <Toolbar data={data} search={search} sort={sort} onSearch={(value) => { resetPage(() => { setSearch(value); }); }} onSort={(value) => { resetPage(() => { setSort(value); }); }} />
        <Products data={data} page={page} loading={loading} error={loadError} />
        <Pagination page={page} loading={loading} onPage={(next) => { setPage((current) => ({ ...current, page: next })); }} />
      </section>
    </main>
    <footer className="sf__footer"><strong>{data.store.name}</strong><span>Catálogo e pedidos online</span></footer>
    {cartOpen ? <CartPanel cart={cart} whatsappEnabled={whatsappEnabled} onChange={setCart} onClose={() => { setCartOpen(false); }} /> : null}
  </div>;
}
