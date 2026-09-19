import { useMemo, useState } from "react";
import type { Product, ProductImage, ProductVariant } from "@white-label/catalog";
import { getCatalogPublicMediaUrl, resolvePurchasableSelection } from "@white-label/catalog";
import { storefrontMoney } from "./format.ts";

function stockLimit(product: Product, variant: ProductVariant | undefined): number {
  if (!product.trackInventory) return 999;
  return variant === undefined ? product.stockQuantity : variant.stockQuantity;
}
function selectionImages(product: Product, variantId: string | null): ProductImage[] {
  if (variantId === null) return product.images.filter((image) => image.variantId === null);
  const exact = product.images.filter((image) => image.variantId === variantId);
  const common = product.images.filter((image) => image.variantId === null);
  return exact.length > 0 ? [...exact, ...common] : common;
}
function variantLabel(variant: ProductVariant): string {
  const attributes = Object.values(variant.attributes).filter(Boolean);
  return attributes.length > 0 ? `${variant.name} · ${attributes.join(" / ")}` : variant.name;
}
function Price(props: Readonly<{ current: number | null; compareAt: number | null; show: boolean }>): React.JSX.Element | null {
  if (!props.show) return null;
  if (props.current === null) return <div className="sf__price">Selecione uma variante</div>;
  const oldPrice = props.compareAt !== null && props.compareAt > props.current ? props.compareAt : null;
  return <div className="sf__price-line">
    {oldPrice === null ? null : <span className="sf__old-price">{storefrontMoney(oldPrice)}</span>}
    <span className="sf__price">{storefrontMoney(props.current)}</span>
  </div>;
}

export function ProductDetail(props: Readonly<{
  product: Product;
  categoryName: string | null;
  showPrice: boolean;
  showStock: boolean;
  onClose: () => void;
  onAdd: (product: Product, variantId: string | null, quantity: number) => void;
}>): React.JSX.Element {
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [imageId, setImageId] = useState<string | null>(null);
  const selectedVariant = useMemo(() => props.product.variants.find((item) => item.id === variantId), [props.product.variants, variantId]);
  const selectedId = selectedVariant?.id ?? null;
  const images = useMemo(() => selectionImages(props.product, selectedId), [props.product, selectedId]);
  const image = images.find((item) => item.id === imageId) ?? images.at(0) ?? props.product.images.at(0);
  const imageUrl = image === undefined ? null : getCatalogPublicMediaUrl(props.product, image.objectKey);
  const activeImageId = image?.id ?? "";
  const hasVariants = props.product.variants.length > 0;
  const hasValidSelection = !hasVariants || selectedVariant !== undefined;
  const limit = stockLimit(props.product, selectedVariant);
  const available = hasValidSelection && limit > 0;
  const currentPrice = !hasVariants ? props.product.priceCents : selectedVariant === undefined ? null : resolvePurchasableSelection(props.product, selectedVariant.id).unitPriceCents;
  const compareAt = !hasVariants ? props.product.compareAtPriceCents : selectedVariant?.compareAtPriceCents ?? null;

  function selectVariant(nextId: string): void { setVariantId(nextId); setQuantity(1); setImageId(null); }

  return <div className="sf__overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section className="sf__modal" aria-modal="true" role="dialog">
      <div className="sf__modal-head">
        <div>{props.categoryName ? <p className="sf__meta">{props.categoryName}</p> : null}<h2 style={{ margin: 0 }}>{props.product.name}</h2><p className="sf__meta">{props.product.description ?? ""}</p></div>
        <button className="sf__close" type="button" onClick={props.onClose} aria-label="Fechar">×</button>
      </div>
      <div className="sf__detail">
        <div>
          <div className="sf__detail-image">{image === undefined || imageUrl === null ? <div className="sf__image"><span className="sf__placeholder">Sem imagem</span></div> : <img src={imageUrl} alt={image.altText ?? props.product.name} />}</div>
          {images.length > 1 ? <div className="sf__thumbs">{images.map((item) => <button type="button" key={item.id} data-active={item.id === activeImageId} onClick={() => { setImageId(item.id); }}><img src={getCatalogPublicMediaUrl(props.product, item.objectKey)} alt={item.altText ?? props.product.name} /></button>)}</div> : null}
        </div>
        <div className="sf__panel">
          {hasVariants ? <label><span className="sf__meta">Escolha a variante</span><select className="sf__select" value={variantId} onChange={(event) => { selectVariant(event.target.value); }}><option value="">Selecione…</option>{props.product.variants.map((variant) => <option key={variant.id} value={variant.id}>{variantLabel(variant)} — {storefrontMoney(variant.priceCents)}</option>)}</select></label> : null}
          {selectedVariant !== undefined && Object.keys(selectedVariant.attributes).length > 0 ? <div className="sf__attributes">{Object.entries(selectedVariant.attributes).map(([key, value]) => <span key={key}><strong>{key}:</strong> {value}</span>)}</div> : null}
          <Price current={currentPrice} compareAt={compareAt} show={props.showPrice} />
          {props.showStock && props.product.trackInventory && hasValidSelection ? <div className="sf__meta">{available ? "Em estoque" : "Sem estoque"}</div> : null}
          <label className="sf__field"><span>Quantidade</span><input type="number" min={1} max={Math.max(1, limit)} value={quantity} disabled={!available} onChange={(event) => { const next = Number(event.target.value); setQuantity(Number.isInteger(next) ? Math.min(Math.max(1, next), Math.max(1, limit)) : 1); }} /></label>
          <button className="sf__primary" type="button" disabled={!available} onClick={() => { props.onAdd(props.product, selectedId, quantity); }}>{!hasValidSelection ? "Escolha uma variante" : available ? "Adicionar ao carrinho" : "Indisponível"}</button>
        </div>
      </div>
    </section>
  </div>;
}
