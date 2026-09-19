import { useState } from "react";
import type { SyntheticEvent } from "react";
import { Link } from "@tanstack/react-router";
import type { CatalogPage, Category, Product } from "@white-label/catalog";
import { getCatalogPublicMediaUrl } from "@white-label/catalog";
import { listMerchantProducts } from "../../lib/server/catalog.functions.ts";
import { formatMoney } from "./format.ts";

const PAGE_SIZE = 20;
type LoadPage = (page: number, clear?: boolean) => Promise<void>;

function ProductsFilters(props: Readonly<{
  search: string;
  categoryId: string;
  categories: Category[];
  loading: boolean;
  setSearch: (value: string) => void;
  setCategoryId: (value: string) => void;
  load: LoadPage;
}>): React.JSX.Element {
  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void props.load(1);
  }
  return (
    <form className="k-toolbar" onSubmit={submit}>
      <label className="k-toolbar__search">
        <span className="k-visually-hidden">Buscar produtos</span>
        <input
          id="products-search"
          value={props.search}
          onChange={(event) => { props.setSearch(event.target.value); }}
          placeholder="Buscar por nome ou SKU…"
        />
      </label>
      <label className="k-toolbar__select">
        <span className="k-visually-hidden">Filtrar por categoria</span>
        <select id="products-category" value={props.categoryId} onChange={(event) => { props.setCategoryId(event.target.value); }}>
          <option value="">Todas as categorias</option>
          {props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.active ? "" : " (inativa)"}</option>)}
        </select>
      </label>
      <button className="k-button k-button--primary" type="submit" disabled={props.loading}>{props.loading ? "Buscando…" : "Buscar"}</button>
      {(props.search || props.categoryId) ? <button className="k-button k-button--ghost" type="button" disabled={props.loading} onClick={() => { void props.load(1, true); }}>Limpar</button> : null}
    </form>
  );
}

function stockLabel(product: Product): string {
  if (!product.trackInventory) return "Não controlado";
  if (product.variants.length) return String(product.variants.reduce((total, variant) => total + variant.stockQuantity, 0));
  return String(product.stockQuantity);
}

function ProductIdentity({ product }: Readonly<{ product: Product }>): React.JSX.Element {
  const image = product.images.at(0);
  return (
    <div className="k-product-row">
      <div className="k-product-thumb">
        {image ? <img src={getCatalogPublicMediaUrl(product, image.objectKey)} alt={image.altText ?? product.name} loading="lazy" /> : <span>Sem foto</span>}
      </div>
      <div>
        <strong>{product.name}</strong>
        <div className="k-row__meta">{product.sku || "Sem SKU"}</div>
      </div>
    </div>
  );
}

function ProductsTable(props: Readonly<{ data: CatalogPage; categories: Category[] }>): React.JSX.Element {
  return (
    <div className="k-table-wrap k-table-wrap--flush">
      <table className="k-table">
        <thead><tr><th>Produto</th><th>Categoria</th><th className="k-table__number">Preço</th><th className="k-table__number">Estoque</th><th>Variantes</th><th>Status</th><th className="k-table__action">Ação</th></tr></thead>
        <tbody>
          {props.data.items.map((product) => {
            const category = props.categories.find((item) => item.id === product.categoryId);
            return (
              <tr key={product.id}>
                <td><ProductIdentity product={product} /></td>
                <td>{category?.name ?? <span className="k-muted">Sem categoria</span>}</td>
                <td className="k-table__number">{formatMoney(product.priceCents)}</td>
                <td className="k-table__number">{stockLabel(product)}</td>
                <td>{product.variants.length}</td>
                <td><span className={product.active ? "k-status-pill k-status-pill--active" : "k-status-pill"}>{product.active ? "Ativo" : "Inativo"}</span></td>
                <td className="k-table__action"><Link className="k-text-action" to="/admin/products/$id" params={{ id: product.id }}>Editar</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductsPagination(props: Readonly<{ data: CatalogPage; loading: boolean; load: LoadPage }>): React.JSX.Element {
  const totalPages = Math.max(1, Math.ceil(props.data.total / props.data.pageSize));
  return (
    <div className="k-pagination">
      <span>{props.data.total} produto(s) · página {props.data.page} de {totalPages}</span>
      <div>
        <button className="k-button" type="button" disabled={props.loading || props.data.page <= 1} onClick={() => { void props.load(props.data.page - 1); }}>Anterior</button>
        <button className="k-button" type="button" disabled={props.loading || props.data.page >= totalPages} onClick={() => { void props.load(props.data.page + 1); }}>Próxima</button>
      </div>
    </div>
  );
}

export function ProductsList(props: Readonly<{ initialPage: CatalogPage; categories: Category[] }>): React.JSX.Element {
  const [data, setData] = useState(props.initialPage);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(page: number, clear = false): Promise<void> {
    setLoading(true); setError("");
    if (clear) { setSearch(""); setCategoryId(""); }
    try {
      const result = await listMerchantProducts({ data: {
        page,
        pageSize: PAGE_SIZE,
        search: clear ? undefined : search.trim() || undefined,
        categoryId: clear ? undefined : categoryId || undefined,
        sort: "position",
      } });
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os produtos.");
    } finally { setLoading(false); }
  }

  return (
    <section className="k-workspace-section">
      <div className="k-section-head">
        <div><h2>Catálogo de produtos</h2><p>{data.total} produto(s) encontrados.</p></div>
        <Link className="k-button k-button--primary" to="/admin/products/new">Novo produto</Link>
      </div>
      <ProductsFilters search={search} categoryId={categoryId} categories={props.categories} loading={loading} setSearch={setSearch} setCategoryId={setCategoryId} load={load} />
      {error ? <div className="k-inline-state k-inline-state--error"><strong>Não foi possível carregar</strong><span>{error}</span><button className="k-button" type="button" onClick={() => { void load(data.page); }}>Tentar novamente</button></div> : null}
      {!error && !loading && data.items.length === 0 ? <div className="k-inline-state"><strong>Nenhum produto encontrado</strong><span>Ajuste os filtros ou cadastre um novo produto.</span><Link className="k-text-action" to="/admin/products/new">Cadastrar produto</Link></div> : null}
      {!error && data.items.length > 0 ? <ProductsTable data={data} categories={props.categories} /> : null}
      {!error && data.total > 0 ? <ProductsPagination data={data} loading={loading} load={load} /> : null}
    </section>
  );
}
