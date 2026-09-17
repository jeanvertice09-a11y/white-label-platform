import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  addItemToCart,
  buildCatalogMediaUrl,
  buildWhatsappCheckoutUrl,
  createEmptyCart,
  getCartItemCount,
  getCartTotalCents,
  removeCartItem,
  setCartItemQuantity,
} from "@white-label/catalog";
import type {
  CatalogCart,
  CatalogListInput,
  CatalogProductDetail,
  CatalogSettings,
  Product,
  PublicStorefrontSnapshot,
} from "@white-label/catalog";
import {
  getPublicCatalogData,
  getPublicProductData,
} from "../lib/server/catalog.functions.ts";
import "../features/catalog/catalog.css";

type PublicCatalogPayload = {
  store: { name: string; slug: string };
  catalog: PublicStorefrontSnapshot;
  mediaBaseUrl: string | null;
};

type ProductPayload = {
  store: { name: string; slug: string };
  detail: CatalogProductDetail;
  settings: CatalogSettings | null;
  mediaBaseUrl: string | null;
};

export const Route = createFileRoute("/catalog")({
  loader: () =>
    getPublicCatalogData({
      data: { page: 1, pageSize: 24, sort: "newest" },
    }),
  errorComponent: CatalogError,
  component: PublicCatalogPage,
});

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function CatalogError(): React.JSX.Element {
  return (
    <section className="catalog-error" role="alert">
      <strong>Catálogo não encontrado</strong>
      <p>
        Este endereço não está vinculado a um catálogo público ativo.
      </p>
    </section>
  );
}

function PublicCatalogPage(): React.JSX.Element {
  const initial = Route.useLoaderData() as PublicCatalogPayload;
  const [payload, setPayload] = useState(initial);
  const [query, setQuery] = useState<CatalogListInput>({
    page: 1,
    pageSize: 24,
    sort: "newest",
  });
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ProductPayload | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cart, setCart] = useState<CatalogCart>(() => {
    const product = initial.catalog.products.items[0];
    return product
      ? createEmptyCart({ tenantId: product.tenantId, storeId: product.storeId })
      : {
          tenantId: "",
          storeId: "",
          items: [],
        };
  });
  const [checkoutError, setCheckoutError] = useState("");

  const settings = payload.catalog.settings;
  const style = {
    "--catalog-primary": settings.primaryColor,
    "--catalog-accent": settings.accentColor,
    "--catalog-bg": settings.backgroundColor,
  } as CSSProperties;

  const banner = payload.catalog.banners[0];
  const bannerUrl = buildCatalogMediaUrl(
    payload.mediaBaseUrl,
    banner?.objectKey,
  );

  const cartTotal = getCartTotalCents(cart);
  const itemCount = getCartItemCount(cart);

  async function reload(next: CatalogListInput): Promise<void> {
    setLoading(true);
    try {
      const data = (await getPublicCatalogData({
        data: {
          page: next.page ?? 1,
          pageSize: next.pageSize ?? 24,
          search: next.search,
          categorySlug: next.categorySlug,
          sort: next.sort ?? "newest",
        },
      })) as PublicCatalogPayload;
      setPayload(data);
      setQuery(next);
    } finally {
      setLoading(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void reload({
      ...query,
      page: 1,
      search: searchText.trim() || undefined,
    });
  }

  async function openProduct(product: Product): Promise<void> {
    setDetailLoading(true);
    setSelectedVariantId(null);
    try {
      const detail = (await getPublicProductData({
        data: { slug: product.slug },
      })) as ProductPayload;
      setSelected(detail);

      if (!cart.tenantId && !cart.storeId) {
        setCart(
          createEmptyCart({
            tenantId: detail.detail.product.tenantId,
            storeId: detail.detail.product.storeId,
          }),
        );
      }
    } finally {
      setDetailLoading(false);
    }
  }

  function addSelectedToCart(): void {
    if (!selected) return;
    const product = selected.detail.product;
    const scope = {
      tenantId: product.tenantId,
      storeId: product.storeId,
    };

    const base =
      cart.tenantId && cart.storeId ? cart : createEmptyCart(scope);

    const next = addItemToCart(scope, base, {
      product,
      variants: selected.detail.variants,
      selectedVariantId,
      quantity: 1,
    });

    setCart(next);
    setSelected(null);
    setSelectedVariantId(null);
  }

  function checkoutWhatsapp(): void {
    setCheckoutError("");
    try {
      const url = buildWhatsappCheckoutUrl({
        storeName: payload.store.name,
        cart,
        settings,
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Não foi possível iniciar o pedido",
      );
    }
  }

  const fontFamily = useMemo(() => {
    const fonts: Record<string, string> = {
      system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      inter: "Inter, system-ui, sans-serif",
      manrope: "Manrope, system-ui, sans-serif",
      poppins: "Poppins, system-ui, sans-serif",
      montserrat: "Montserrat, system-ui, sans-serif",
      playfair: "'Playfair Display', Georgia, serif",
    };
    return fonts[settings.fontKey] ?? fonts["system"];
  }, [settings.fontKey]);

  return (
    <section
      className={`catalog-shell catalog-layout-${settings.layout}`}
      style={{ ...style, fontFamily }}
    >
      <header className="catalog-header">
        <div className="catalog-brand">
          <h1>{payload.store.name}</h1>
          <span className="catalog-muted">
            {settings.labels["catalogSubtitle"] ?? "Catálogo"}
          </span>
        </div>
        <strong>
          Carrinho: {itemCount} {itemCount === 1 ? "item" : "itens"}
        </strong>
      </header>

      {bannerUrl ? (
        <a
          href={banner?.linkUrl ?? "#produtos"}
          style={{ display: "block", marginBottom: 24 }}
        >
          <img
            src={bannerUrl}
            alt={banner?.title ?? "Banner da loja"}
            style={{
              width: "100%",
              maxHeight: 320,
              objectFit: "cover",
              borderRadius: 20,
            }}
          />
        </a>
      ) : null}

      <div className="catalog-toolbar" id="produtos">
        {settings.showSearch ? (
          <form onSubmit={submitSearch} style={{ display: "flex", gap: 8 }}>
            <input
              className="catalog-control"
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar produtos"
              aria-label="Buscar produtos"
            />
            <button className="catalog-button" type="submit" disabled={loading}>
              Buscar
            </button>
          </form>
        ) : <span />}

        <select
          className="catalog-control"
          value={query.sort ?? "newest"}
          onChange={(event) => {
            const sort = event.target.value as NonNullable<CatalogListInput["sort"]>;
            void reload({ ...query, page: 1, sort });
          }}
          aria-label="Ordenar produtos"
        >
          <option value="newest">Mais recentes</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
          <option value="name_asc">Nome</option>
        </select>
      </div>

      {settings.showCategories && payload.catalog.categories.length > 0 ? (
        <div className="catalog-chip-row" style={{ marginTop: 16 }}>
          <button
            className="catalog-chip"
            type="button"
            onClick={() =>
              void reload({ ...query, page: 1, categorySlug: undefined })
            }
          >
            Todos
          </button>
          {payload.catalog.categories.map((category) => (
            <button
              className="catalog-chip"
              type="button"
              key={category.id}
              onClick={() =>
                void reload({
                  ...query,
                  page: 1,
                  categorySlug: category.slug,
                })
              }
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      {payload.catalog.products.items.length === 0 ? (
        <div className="catalog-empty" style={{ marginTop: 24 }}>
          Nenhum produto encontrado.
        </div>
      ) : (
        <div className="catalog-grid">
          {payload.catalog.products.items.map((product) => {
            const imageUrl = buildCatalogMediaUrl(
              payload.mediaBaseUrl,
              product.primaryImageObjectKey,
            );
            return (
              <button
                type="button"
                key={product.id}
                className="catalog-card"
                onClick={() => void openProduct(product)}
                style={{ padding: 0, textAlign: "left", cursor: "pointer" }}
              >
                {imageUrl ? (
                  <img
                    className="catalog-card-image"
                    src={imageUrl}
                    alt={product.name}
                    loading="lazy"
                  />
                ) : (
                  <span className="catalog-card-placeholder">Sem imagem</span>
                )}
                <span className="catalog-card-body">
                  <strong>{product.name}</strong>
                  {settings.showPrices ? (
                    <span>
                      {product.compareAtPriceCents &&
                      product.compareAtPriceCents > product.priceCents ? (
                        <span className="catalog-old-price">
                          {formatMoney(product.compareAtPriceCents)}{" "}
                        </span>
                      ) : null}
                      <span className="catalog-price">
                        {formatMoney(product.priceCents)}
                      </span>
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {payload.catalog.products.totalPages > 1 ? (
        <div
          className="catalog-admin-actions"
          style={{ justifyContent: "center", marginTop: 24 }}
        >
          <button
            className="catalog-button catalog-button-secondary"
            type="button"
            disabled={loading || payload.catalog.products.page <= 1}
            onClick={() =>
              void reload({
                ...query,
                page: payload.catalog.products.page - 1,
              })
            }
          >
            Anterior
          </button>
          <span style={{ alignSelf: "center" }}>
            {payload.catalog.products.page} de {payload.catalog.products.totalPages}
          </span>
          <button
            className="catalog-button catalog-button-secondary"
            type="button"
            disabled={
              loading ||
              payload.catalog.products.page >= payload.catalog.products.totalPages
            }
            onClick={() =>
              void reload({
                ...query,
                page: payload.catalog.products.page + 1,
              })
            }
          >
            Próxima
          </button>
        </div>
      ) : null}

      {detailLoading ? (
        <div className="catalog-empty" style={{ marginTop: 24 }}>
          Carregando produto...
        </div>
      ) : null}

      {selected ? (
        <ProductDetail
          payload={selected}
          selectedVariantId={selectedVariantId}
          onVariantChange={setSelectedVariantId}
          onAdd={addSelectedToCart}
          onClose={() => setSelected(null)}
        />
      ) : null}

      {itemCount > 0 ? (
        <aside className="catalog-admin-form" style={{ marginTop: 28 }}>
          <div className="catalog-admin-header">
            <div>
              <strong>Seu pedido</strong>
              <div className="catalog-muted">{itemCount} itens</div>
            </div>
            <strong>{formatMoney(cartTotal)}</strong>
          </div>

          {cart.items.map((item) => (
            <div key={item.key} className="catalog-admin-header">
              <div>
                <strong>{item.productName}</strong>
                {item.variantName ? (
                  <div className="catalog-muted">{item.variantName}</div>
                ) : null}
                <div className="catalog-muted">
                  {formatMoney(item.unitPriceCents)} cada
                </div>
              </div>
              <div className="catalog-admin-actions">
                <button
                  type="button"
                  className="catalog-chip"
                  onClick={() =>
                    setCart(
                      setCartItemQuantity(
                        {
                          tenantId: cart.tenantId,
                          storeId: cart.storeId,
                        },
                        cart,
                        item.key,
                        Math.max(0, item.quantity - 1),
                      ),
                    )
                  }
                >
                  −
                </button>
                <span style={{ alignSelf: "center" }}>{item.quantity}</span>
                <button
                  type="button"
                  className="catalog-chip"
                  onClick={() =>
                    setCart(
                      setCartItemQuantity(
                        {
                          tenantId: cart.tenantId,
                          storeId: cart.storeId,
                        },
                        cart,
                        item.key,
                        item.quantity + 1,
                      ),
                    )
                  }
                >
                  +
                </button>
                <button
                  type="button"
                  className="catalog-chip"
                  onClick={() =>
                    setCart(
                      removeCartItem(
                        {
                          tenantId: cart.tenantId,
                          storeId: cart.storeId,
                        },
                        cart,
                        item.key,
                      ),
                    )
                  }
                >
                  Remover
                </button>
              </div>
            </div>
          ))}

          {(settings.checkoutMode === "whatsapp" ||
            settings.checkoutMode === "both") && (
            <button
              type="button"
              className="catalog-button"
              onClick={checkoutWhatsapp}
            >
              Finalizar pelo WhatsApp
            </button>
          )}

          {settings.checkoutMode === "online" ||
          settings.checkoutMode === "both" ? (
            <button
              type="button"
              className="catalog-button catalog-button-secondary"
              disabled
              title="Pagamento online será habilitado quando o gateway da loja estiver configurado."
            >
              Pagamento online
            </button>
          ) : null}

          {checkoutError ? (
            <p role="alert" style={{ margin: 0, color: "#b91c1c" }}>
              {checkoutError}
            </p>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}

function ProductDetail(props: {
  payload: ProductPayload;
  selectedVariantId: string | null;
  onVariantChange: (id: string | null) => void;
  onAdd: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const { detail, mediaBaseUrl } = props.payload;
  const { product, variants, images } = detail;
  const firstImage =
    buildCatalogMediaUrl(mediaBaseUrl, images[0]?.objectKey) ??
    buildCatalogMediaUrl(mediaBaseUrl, product.primaryImageObjectKey);

  const selectedVariant = variants.find(
    (variant) => variant.id === props.selectedVariantId,
  );
  const shownPrice = selectedVariant?.priceCents ?? product.priceCents;
  const requiresVariant = variants.length > 0;

  return (
    <div
      className="catalog-admin-form"
      style={{ marginTop: 30 }}
      aria-label={`Detalhes de ${product.name}`}
    >
      <div className="catalog-admin-header">
        <strong>Detalhes do produto</strong>
        <button
          type="button"
          className="catalog-chip"
          onClick={props.onClose}
        >
          Fechar
        </button>
      </div>

      <div className="catalog-product-layout">
        <div className="catalog-product-gallery">
          {firstImage ? (
            <img
              className="catalog-product-image"
              src={firstImage}
              alt={product.name}
            />
          ) : (
            <div className="catalog-product-placeholder">Sem imagem</div>
          )}
        </div>

        <div className="catalog-product-panel">
          <h2 className="catalog-product-title">{product.name}</h2>
          {product.description ? <p>{product.description}</p> : null}
          <strong className="catalog-price">{formatMoney(shownPrice)}</strong>

          {variants.length > 0 ? (
            <div>
              <strong>Escolha uma opção</strong>
              <div className="catalog-option-grid" style={{ marginTop: 8 }}>
                {variants.map((variant) => (
                  <button
                    type="button"
                    key={variant.id}
                    className="catalog-option"
                    aria-pressed={props.selectedVariantId === variant.id}
                    onClick={() => props.onVariantChange(variant.id)}
                  >
                    {variant.name} — {formatMoney(variant.priceCents)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="catalog-button"
            disabled={requiresVariant && !props.selectedVariantId}
            onClick={props.onAdd}
          >
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </div>
  );
}
