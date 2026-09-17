import { buildCatalogMediaUrl } from "@white-label/catalog";
import type { ProductVariant } from "@white-label/catalog";
import type { ProductPayload } from "./view-model.ts";
import { formatCatalogMoney } from "./view-model.ts";

export function CatalogProductDetail(props: {
  payload: ProductPayload;
  selectedVariantId: string | null;
  onVariantChange: (id: string | null) => void;
  onAdd: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const detail = props.payload.detail;
  const firstImage =
    buildCatalogMediaUrl(
      props.payload.mediaBaseUrl,
      detail.images[0]?.objectKey,
    ) ??
    buildCatalogMediaUrl(
      props.payload.mediaBaseUrl,
      detail.product.primaryImageObjectKey,
    );
  const selected = detail.variants.find(
    (variant) => variant.id === props.selectedVariantId,
  );
  const shownPrice = selected?.priceCents ?? detail.product.priceCents;

  return (
    <div className="catalog-admin-form" style={{ marginTop: 30 }}>
      <DetailHeader onClose={props.onClose} />
      <div className="catalog-product-layout">
        <ProductImage url={firstImage} name={detail.product.name} />
        <div className="catalog-product-panel">
          <h2 className="catalog-product-title">{detail.product.name}</h2>
          {detail.product.description ? <p>{detail.product.description}</p> : null}
          <strong className="catalog-price">{formatCatalogMoney(shownPrice)}</strong>
          <VariantOptions
            variants={detail.variants}
            selectedId={props.selectedVariantId}
            onChange={props.onVariantChange}
          />
          <button
            type="button"
            className="catalog-button"
            disabled={detail.variants.length > 0 && !props.selectedVariantId}
            onClick={props.onAdd}
          >
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailHeader(props: { onClose: () => void }): React.JSX.Element {
  return (
    <div className="catalog-admin-header">
      <strong>Detalhes do produto</strong>
      <button type="button" className="catalog-chip" onClick={props.onClose}>
        Fechar
      </button>
    </div>
  );
}

function ProductImage(props: {
  url: string | null;
  name: string;
}): React.JSX.Element {
  return (
    <div className="catalog-product-gallery">
      {props.url ? (
        <img className="catalog-product-image" src={props.url} alt={props.name} />
      ) : (
        <div className="catalog-product-placeholder">Sem imagem</div>
      )}
    </div>
  );
}

function VariantOptions(props: {
  variants: ProductVariant[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}): React.JSX.Element | null {
  if (props.variants.length === 0) return null;

  return (
    <div>
      <strong>Escolha uma opção</strong>
      <div className="catalog-option-grid" style={{ marginTop: 8 }}>
        {props.variants.map((variant) => (
          <button
            type="button"
            key={variant.id}
            className="catalog-option"
            aria-pressed={props.selectedId === variant.id}
            onClick={() => { props.onChange(variant.id); }}
          >
            {variant.name} — {formatCatalogMoney(variant.priceCents)}
          </button>
        ))}
      </div>
    </div>
  );
}
