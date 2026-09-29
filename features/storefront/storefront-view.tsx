import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { CatalogAdvancedSettings, CatalogPage, Category, StorefrontSnapshot } from "@white-label/catalog";
import { getCatalogAdvancedSettings, getCatalogBehavior, getCatalogPublicMediaUrl } from "@white-label/catalog";
import { listPublicCatalogProducts } from "../../lib/server/catalog.functions.ts";
import { storefrontCategoryPath } from "../../lib/storefront-paths.ts";
import { CartPanel } from "./cart-panel.tsx";
import { ProductCard } from "./product-card.tsx";
import { PromotionalBar } from "./promotional-bar.tsx";
import { ShareActions } from "./share-actions.tsx";
import { StorefrontFooter } from "./storefront-footer.tsx";
import { StorefrontTracking } from "./storefront-tracking.tsx";
import { storefrontAdvancedTheme } from "./storefront-advanced-theme.ts";
import { storefrontResponsiveTheme } from "./storefront-responsive-theme.ts";
import { storefrontTheme } from "./storefront-theme.ts";
import { storefrontMarketTheme } from "./storefront-market-theme.ts";
import { useStorefrontCart } from "./use-storefront-cart.ts";

type Sort = "position" | "name" | "price_asc" | "price_desc";
function categoryName(categories: Category[], categoryId: string | null): string | null { if (!categoryId) return null; const category = categories.find((item) => item.id === categoryId); if (!category) return null; const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null; return parent ? `${parent.name} / ${category.name}` : category.name; }

function useListing(data: StorefrontSnapshot, initialCategoryId: string) {
  const [search, setSearch] = useState(""); const [categoryId] = useState(initialCategoryId); const [sort, setSort] = useState<Sort>("position"); const [page, setPage] = useState(data.products); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const firstLoad = useRef(true);
  useEffect(() => { if (firstLoad.current) { firstLoad.current = false; return; } let active = true; const timer = window.setTimeout(() => { setLoading(true); setError(""); void listPublicCatalogProducts({ data: { page: page.page, pageSize: 12, search: search.trim() || undefined, categoryId: categoryId || undefined, sort } }).then((next) => { if (active) setPage(next); }).catch(() => { if (active) setError("Tente novamente."); }).finally(() => { if (active) setLoading(false); }); }, search ? 250 : 0); return () => { active = false; window.clearTimeout(timer); }; }, [search, categoryId, sort, page.page]);
  function reset(update: () => void): void { setPage((current) => ({ ...current, page: 1 })); update(); }
  return { search, categoryId, sort, page, loading, error, setPage, setSearch, setSort, reset };
}

function StoreHeader(props: Readonly<{ data: StorefrontSnapshot; page: CatalogPage; advanced: CatalogAdvancedSettings; loading: boolean; itemCount: number; cartEnabled: boolean; search: string; onSearch: (value: string) => void; onCart: () => void }>): React.JSX.Element {
  const suggestions = props.advanced.searchSuggestions && props.search.trim().length >= 2 && !props.loading ? props.page.items.slice(0, 5) : [];
  return <header className="sf__header">
    <div className="sf__header-inner">
      <a className="sf__logo" href="/">{props.data.store.name}</a>
      {props.data.settings.showSearch ? <div className="sf__header-search-area"><label className="sf__header-search"><span className="sr-only">Buscar produtos</span><input type="search" value={props.search} onChange={(event) => { props.onSearch(event.target.value); }} placeholder="O que você está procurando?" aria-label="Buscar produtos" /><span aria-hidden="true">⌕</span></label>{suggestions.length ? <div className="sf__suggestions" role="listbox" aria-label="Sugestões de busca">{suggestions.map((product) => <button className="sf__suggestion" type="button" key={product.id} onClick={() => { props.onSearch(product.name); }}>{product.name}</button>)}</div> : null}</div> : null}
      <a className="sf__header-help" href="#rodape-loja">Ajuda e contato</a>
      {props.cartEnabled ? <button className="sf__cart-button" type="button" onClick={props.onCart} aria-label={`Abrir carrinho com ${String(props.itemCount)} item(ns)`}><span aria-hidden="true">♧</span><span>Meu carrinho</span><strong>{props.itemCount}</strong></button> : null}
    </div>
    <nav className="sf__nav" aria-label="Navegação da loja"><div className="sf__nav-inner"><a href="/">Página inicial</a>{props.data.settings.showCategories ? <a href="#categorias">Categorias</a> : null}<a href="#produtos">Todos os produtos</a><a href="#rodape-loja">Sobre a loja</a></div></nav>
  </header>;
}

function Categories(props: Readonly<{ categories: Category[]; activeId: string }>): React.JSX.Element | null {
  if (!props.categories.length) return null;
  return <section className="sf__categories" id="categorias" aria-labelledby="sf-categories-title"><div className="sf__section-head"><div><span className="sf__eyebrow">Explore o catálogo</span><h2 id="sf-categories-title">Compre por categoria</h2></div><a href="#produtos">Ver todos os produtos →</a></div><div className="sf__category-list"><a className={!props.activeId ? "is-active" : ""} href="/"><span aria-hidden="true">✦</span>Todos os produtos</a>{props.categories.map((category) => <a className={props.activeId === category.id ? "is-active" : ""} key={category.id} href={storefrontCategoryPath(category.slug)}><span aria-hidden="true">{category.name.charAt(0).toUpperCase()}</span>{categoryName(props.categories, category.id)}</a>)}</div></section>;
}

function Toolbar(props: Readonly<{ page: CatalogPage; sort: Sort; loading: boolean; onSort: (value: Sort) => void }>): React.JSX.Element {
  return <div className="sf__toolbar"><span aria-live="polite">{props.loading ? "Atualizando produtos…" : `${String(props.page.total)} produtos encontrados`}</span><label>Ordenar por <select className="sf__select sf__sort" value={props.sort} onChange={(event) => { props.onSort(event.target.value as Sort); }} aria-label="Ordenar produtos"><option value="position">Relevância</option><option value="name">Nome</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option></select></label></div>;
}

function Pagination(props: Readonly<{ page: CatalogPage; loading: boolean; onPage: (page: number) => void }>): React.JSX.Element | null { const pages = Math.max(1, Math.ceil(props.page.total / props.page.pageSize)); if (pages <= 1) return null; return <nav className="sf__pagination" aria-label="Paginação dos produtos"><button type="button" disabled={props.loading || props.page.page <= 1} onClick={() => { props.onPage(props.page.page - 1); }}>Anterior</button><span>{props.page.page} de {pages}</span><button type="button" disabled={props.loading || props.page.page >= pages} onClick={() => { props.onPage(props.page.page + 1); }}>Próxima</button></nav>; }

function Products(props: Readonly<{ data: StorefrontSnapshot; page: CatalogPage; advanced: CatalogAdvancedSettings; showDescription: boolean; showSku: boolean; loading: boolean; error: string }>): React.JSX.Element {
  if (props.loading) return <div className={`sf__grid sf__grid--columns-${String(props.advanced.productsPerRow)}`} aria-busy="true">{Array.from({ length: 8 }, (_, index) => <div className="sf__product-skeleton" key={index}><span /><i /><i /></div>)}</div>;
  if (props.error) return <div className="sf__empty"><strong>Não foi possível atualizar os produtos</strong><span>{props.error}</span></div>;
  if (!props.page.items.length) return <div className="sf__empty"><strong>Nenhum produto encontrado</strong><span>Tente outro termo ou volte para todos os produtos.</span></div>;
  return <div className={`sf__grid sf__grid--columns-${String(props.advanced.productsPerRow)}`}>{props.page.items.map((product) => <ProductCard key={product.id} product={product} categoryName={categoryName(props.data.categories, product.categoryId)} showPrice={props.data.settings.showPrice} showDescription={props.showDescription} showSku={props.showSku} cardStyle={props.advanced.cardStyle} />)}</div>;
}

export function StorefrontView(props: Readonly<{ data: StorefrontSnapshot; initialCategoryId?: string; pageTitle?: string }>): React.JSX.Element {
  const { data } = props; const listing = useListing(data, props.initialCategoryId ?? ""); const behavior = getCatalogBehavior(data.settings); const advanced = getCatalogAdvancedSettings(data.settings); const cartEnabled = behavior.cartEnabled && behavior.showBuyButton && !behavior.catalogOnly;
  const [cart, setCart] = useStorefrontCart(data.store, cartEnabled, behavior.persistCart, behavior.quantityEnabled); const [cartOpen, setCartOpen] = useState(false);
  const theme = { "--sf-primary":data.settings.primaryColor,"--sf-accent":data.settings.accentColor,"--sf-bg":data.settings.backgroundColor,"--sf-font":data.settings.fontFamily === "serif" ? "Georgia,serif" : "Inter,system-ui,sans-serif" } as CSSProperties;
  const banner = data.banners.at(0); const whatsappEnabled = behavior.showWhatsapp && cartEnabled && data.settings.checkoutMode !== "online" && Boolean(data.settings.whatsappPhone); const onlineEnabled = cartEnabled && data.settings.checkoutMode !== "whatsapp"; const itemCount = cart.items.reduce((total, item) => total + item.quantity, 0);
  return <div className={`sf sf--${data.settings.layout}`} style={theme}><style>{storefrontTheme + storefrontAdvancedTheme + storefrontResponsiveTheme + storefrontMarketTheme}</style><StorefrontTracking settings={data.settings} initialEvent={{ type: "catalog_view", itemIds: data.products.items.map((product) => product.id) }} /><PromotionalBar merchandising={data.merchandising} /><StoreHeader data={data} page={listing.page} advanced={advanced} loading={listing.loading} itemCount={itemCount} cartEnabled={cartEnabled} search={listing.search} onSearch={(value) => { listing.reset(() => { listing.setSearch(value); }); }} onCart={() => { setCartOpen(true); }} /><main className="sf__main">{!props.pageTitle ? <div className="sf__service-strip"><span>✓ Compra simples e segura</span><span>✓ Produtos selecionados para você</span><span>✓ Atendimento direto com a loja</span></div> : null}{banner ? <a className="sf__banner" href={banner.href ?? undefined}><img src={getCatalogPublicMediaUrl(banner,banner.imageObjectKey)} alt={banner.altText ?? banner.title ?? data.store.name} /></a> : !props.pageTitle ? <section className="sf__hero"><div><span className="sf__eyebrow">BEM-VINDO À SUA LOJA</span><h1>Encontre o que combina com você.</h1><p>Explore os produtos, compare suas opções e escolha com tranquilidade.</p><a href="#produtos">Explorar produtos <span aria-hidden="true">→</span></a></div><div className="sf__hero-art" aria-hidden="true"><span>DESCUBRA<br />O SEU<br />PRÓXIMO<br />FAVORITO.</span><i>✳</i></div></section> : null}<section className="sf__intro"><span className="sf__eyebrow">{props.pageTitle ? "Categoria" : "NOSSAS ESCOLHAS"}</span><h1>{props.pageTitle ?? "Sua próxima descoberta começa aqui"}</h1>{!props.pageTitle && data.profile?.description ? <p>{data.profile.description}</p> : !props.pageTitle && data.settings.labels["subtitle"] ? <p>{data.settings.labels["subtitle"]}</p> : null}{behavior.showShare ? <ShareActions title={props.pageTitle ?? data.store.name} /> : null}{behavior.catalogOnly ? <p className="sf__meta">Catálogo em modo vitrine.</p> : null}</section>{data.settings.showCategories ? <Categories categories={data.categories} activeId={listing.categoryId} /> : null}<section className="sf__products" id="produtos" aria-labelledby="sf-products-title"><div className="sf__section-head"><div><span className="sf__eyebrow">VITRINE</span><h2 id="sf-products-title">{props.pageTitle ? `Produtos em ${props.pageTitle}` : "Encontre seu favorito"}</h2></div></div><Toolbar page={listing.page} sort={listing.sort} loading={listing.loading} onSort={(value) => { listing.reset(() => { listing.setSort(value); }); }} /><Products data={data} page={listing.page} advanced={advanced} showDescription={behavior.showDescription} showSku={behavior.showSku} loading={listing.loading} error={listing.error} /><Pagination page={listing.page} loading={listing.loading} onPage={(next) => { listing.setPage((current) => ({ ...current, page: next })); }} /></section></main><StorefrontFooter storeName={data.store.name} profile={data.profile} />{cartOpen && cartEnabled ? <CartPanel cart={cart} whatsappEnabled={whatsappEnabled} onlineEnabled={onlineEnabled} showPrice={data.settings.showPrice} quantityEnabled={behavior.quantityEnabled} checkoutSettings={advanced} onChange={setCart} onClose={() => { setCartOpen(false); }} /> : null}</div>;
}
