import { useMemo, useState } from "react";
import type { Product } from "@white-label/catalog";
import {
  getCatalogPublicMediaUrl,
  resolvePurchasableSelection,
} from "@white-label/catalog";
import { storefrontMoney } from "./format.ts";

function stockAvailable(product: Product, variantId: string | null): boolean {
  if (!product.trackInventory) return true;
  if (!product.variants.length) return product.stockQuantity > 0;
  const variant = product.variants.find((item) => item.id === variantId);
  return Boolean(variant && variant.stockQuantity > 0);
}

function selectedPrice(product: Product, variantId: string): number | null {
  if (!product.variants.length) return product.priceCents;
  if (!variantId) return null;
  return resolvePurchasableSelection(product, variantId).unitPriceCents;
}

export function ProductDetail(props: Readonly<{
  product: Product;
  showPrice: boolean;
  showStock: boolean;
  onClose: () => void;
  onAdd: (product: Product, variantId: string | null) => void;
}>): React.JSX.Element {
  const [variantId, setVariantId] = useState("");
  const selectedId = props.product.variants.length ? variantId || null : null;
  const price = useMemo(
    () => selectedPrice(props.product, variantId),
    [props.product, variantId],
  );
  const image = props.product.images.find((item) => item.variantId === selectedId)
    ?? props.product.images.at(0);
  const imageUrl = image
    ? getCatalogPublicMediaUrl(props.product, image.objectKey)
    : null;
  const hasValidSelection = !props.product.variants.length || Boolean(selectedId);
  const available = hasValidSelection && stockAvailable(props.product, selectedId);

  return (
    <div className="sf__overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) props.onClose();
    }}>
      <section className="sf__modal" aria-modal="true" role="dialog">
        <div className="sf__modal-head">
          <div><h2 style={{ margin: 0 }}>{props.product.name}</h2><p className="sf__meta">{props.product.description ?? ""}</p></div>
          <button className="sf__close" type="button" onClick={props.onClose} aria-label="Fechar">×</button>
        </div>
        <div className="sf__detail">
          <div className="sf__detail-image">
            {imageUrl && image ? <img src={imageUrl} alt={image.altText ?? props.product.name} /> : <div className="sf__image"><span className="sf__placeholder">Sem imagem</span></div>}
          </div>
          <div className="sf__panel">
            {props.product.variants.length ? (
              <label><span className="sf__meta">Escolha a variante</span>
                <select className="sf__select" value={variantId} onChange={(event) => { setVariantId(event.target.value); }}>
                  <option value="">Selecione…</option>
                  {props.product.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} — {storefrontMoney(variant.priceCents)}</option>)}
                </select>
              </label>
            ) : null}
            {props.showPrice ? <div className="sf__price">{price === null ? "Selecione uma variante" : storefrontMoney(price)}</div> : null}
            {props.showStock && props.product.trackInventory && hasValidSelection ? <div className="sf__meta">{available ? "Em estoque" : "Sem estoque"}</div> : null}
            <button className="sf__primary" type="button" disabled={!available} onClick={() => { props.onAdd(props.product, selectedId); }}>
              {!hasValidSelection ? "Escolha uma variante" : available ? "Adicionar ao carrinho" : "Indisponível"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
