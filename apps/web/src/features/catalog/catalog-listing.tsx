import type { SyntheticEvent } from "react";
import {
  buildCatalogMediaUrl,
} from "@white-label/catalog";
import type {
  CatalogListInput,
  Category,
  Product,
} from "@white-label/catalog";
import { formatCatalogMoney } from "./view-model.ts";

export function CatalogHeader(props: {
  storeName: string;
  subtitle: string;
  itemCount: number;
}): React.JSX.Element {
  return (
    <header className="catalog-header">
      <div className="catalog-brand">
        <h1>{props.storeName}</h1>
        <span className="catalog-muted">{props.subtitle}</span>
      </div>
      <strong>
        Carrinho: {props.itemCount} {props.itemCount === 1 ? "item" : "itens"}
      </strong>
    </header>
  );
}

export function CatalogFilters(props: {
  query: CatalogListInput;
  searchText: string;
  showSearch: boolean;
  loading: boolean;
  onSearchText: (value: string) => void;
  onReload: (query: CatalogListInput) => Promise<void>;
}): React.JSX.Element {
  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void props.onReload({
      ...props.query,
      page: 1,
      search: props.searchText.trim() || undefined,
    });
  }

  return (
    <div className="catalog-toolbar">
      {props.showSearch ? (
        <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
          <input
            className="catalog-control"
            type="search"
            value={props.searchText}
            onChange={(event) => props.onSearchText(event.target.value)}
            placeholder="Buscar produtos"
            aria-label="Buscar produtos"
          />
          <button className="catalog-button" type="submit" disabled={props.loading}>
            Buscar
          </button>
        </form>
      ) : <span />}
      <SortSelect {...props} />
    </div>
  );
}

function SortSelect(props: {
  query: CatalogListInput;
  loading: boolean;
  onReload: (query: CatalogListInput) => Promise<void>;
}): React.JSX.Element {
  return (
    <select
      className="catalog-control"
      value={props.query.sort ?? "newest"}
      disabled={props.loading}
      onChange={(event) => {
        const sort = event.target.value as NonNullable<CatalogListInput["sort"]>;
        void props.onReload({ ...props.query, page: 1, sort });
      }}
      aria-label="Ordenar produtos"
    >
      <option value="newest">Mais recentes</option>
      <option value="price_asc">Menor preço</option>
      <option value="price_desc">Maior preço</option>
      <option value="name_asc">Nome</option>
    </select>
  );
}

export function CategoryChips(props: {
  categories: Category[];
  query: CatalogListInput;
  onReload: (query: CatalogListInput) => Promise<void>;
}): React.JSX.Element {
  return (
    <div className="catalog-chip-row" style={{ marginTop: 16 }}>
      <button
        className="catalog-chip"
        type="button"
        onClick={() => {
          void props.onReload({ ...props.query, page: 1, categorySlug: undefined });
        }}
      >
        Todos
      </button>
      {props.categories.map((category) => (
        <button
          className="catalog-chip"
          type="button"
          key={category.id}
          onClick={() => {
            void props.onReload({
              ...props.query,
              page: 1,
              categorySlug: category.slug,
            });
          }}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}

export function CatalogProductGrid(props: {
  products: Product[];
  mediaBaseUrl: string | null;
  showPrices: boolean;
  onOpen: (product: Product) => Promise<void>;
}): React.JSX.Element {
  if (props.products.length === 0) {
    return (
      <div className="catalog-empty" style={{ marginTop: 24 }}>
        Nenhum produto encontrado.
      </div>
    );
  }

  return (
    <div className="catalog-grid">
      {props.products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          mediaBaseUrl={props.mediaBaseUrl}
          showPrices={props.showPrices}
          onOpen={props.onOpen}
        />
      ))}
    </div>
  );
}

function ProductCard(props: {
  product: Product;
  mediaBaseUrl: string | null;
  showPrices: boolean;
  onOpen: (product: Product) => Promise<void>;
}): React.JSX.Element {
  const imageUrl = buildCatalogMediaUrl(
    props.mediaBaseUrl,
    props.product.primaryImageObjectKey,
  );

  return (
    <button
      type="button"
      className="catalog-card"
      onClick={() => { void props.onOpen(props.product); }}
      style={{ padding: 0, textAlign: "left", cursor: "pointer" }}
    >
      {imageUrl ? (
        <img
          className="catalog-card-image"
          src={imageUrl}
          alt={props.product.name}
          loading="lazy"
        />
      ) : (
        <span className="catalog-card-placeholder">Sem imagem</span>
      )}
      <span className="catalog-card-body">
        <strong>{props.product.name}</strong>
        {props.showPrices ? <ProductPrice product={props.product} /> : null}
      </span>
    </button>
  );
}

function ProductPrice({ product }: { product: Product }): React.JSX.Element {
  const hasOldPrice =
    product.compareAtPriceCents != null &&
    product.compareAtPriceCents > product.priceCents;

  return (
    <span>
      {hasOldPrice ? (
        <span className="catalog-old-price">
          {formatCatalogMoney(product.compareAtPriceCents ?? 0)}{" "}
        </span>
      ) : null}
      <span className="catalog-price">{formatCatalogMoney(product.priceCents)}</span>
    </span>
  );
}

export function CatalogPagination(props: {
  page: number;
  totalPages: number;
  loading: boolean;
  query: CatalogListInput;
  onReload: (query: CatalogListInput) => Promise<void>;
}): React.JSX.Element | null {
  if (props.totalPages <= 1) return null;

  return (
    <div className="catalog-admin-actions" style={{ justifyContent: "center", marginTop: 24 }}>
      <button
        className="catalog-button catalog-button-secondary"
        type="button"
        disabled={props.loading || props.page <= 1}
        onClick={() => { void props.onReload({ ...props.query, page: props.page - 1 }); }}
      >
        Anterior
      </button>
      <span style={{ alignSelf: "center" }}>{props.page} de {props.totalPages}</span>
      <button
        className="catalog-button catalog-button-secondary"
        type="button"
        disabled={props.loading || props.page >= props.totalPages}
        onClick={() => { void props.onReload({ ...props.query, page: props.page + 1 }); }}
      >
        Próxima
      </button>
    </div>
  );
}
