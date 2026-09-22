import { useMemo, useState } from "react";
import type { Product, ProductImage, ProductVariant } from "@white-label/catalog";
import { getCatalogPublicMediaUrl, hasPromotionalPrice, resolvePurchasableSelection } from "@white-label/catalog";
import { ShareActions } from "./share-actions.tsx";
import { storefrontMoney } from "./format.ts";
import { PromotionBadge } from "./promotion-badge.tsx";

interface ProductDetailProps {
  product: Product; categoryName: string | null; showPrice: boolean; showStock: boolean; showDescription?: boolean; showSku?: boolean;
  showBuyButton?: boolean; quantityEnabled?: boolean; catalogOnly?: boolean; showShare?: boolean; shareUrl?: string; mode?: "modal" | "page";
  onClose?: () => void; onAdd: (product: Product, variantId: string | null, quantity: number) => void;
}

function stockLimit(product: Product, variant: ProductVariant | undefined): number { if (!product.trackInventory) return 999; return variant === undefined ? product.stockQuantity : variant.stockQuantity; }
function selectionImages(product: Product, variantId: string | null): ProductImage[] { if (variantId === null) return product.images.filter((image) => image.variantId === null); const exact = product.images.filter((image) => image.variantId === variantId); const common = product.images.filter((image) => image.variantId === null); return exact.length > 0 ? [...exact, ...common] : common; }
function variantLabel(variant: ProductVariant): string { const attributes = Object.values(variant.attributes).filter(Boolean); return attributes.length > 0 ? `${variant.name} · ${attributes.join(" / ")}` : variant.name; }

function Price(props: Readonly<{ current: number | null; compareAt: number | null; show: boolean }>): React.JSX.Element | null {
  if (!props.show) return null;
  if (props.current === null) return <div className="sf__price sf__price--pending">Selecione uma variante</div>;
  const oldPrice = hasPromotionalPrice(props.current, props.compareAt) ? props.compareAt : null;
  return <div className="sf__price-line sf__price-line--detail">{oldPrice === null ? null : <span className="sf__old-price">{storefrontMoney(oldPrice)}</span>}<span className="sf__price">{storefrontMoney(props.current)}</span></div>;
}

function Gallery(props: Readonly<{ product: Product; images: ProductImage[]; selectedImageId: string | null; onImage: (id: string) => void }>): React.JSX.Element {
  const image = props.images.find((item) => item.id === props.selectedImageId) ?? props.images.at(0) ?? props.product.images.at(0);
  const imageUrl = image === undefined ? null : getCatalogPublicMediaUrl(props.product, image.objectKey);
  return <div className="sf__gallery"><div className="sf__detail-image">{image === undefined || imageUrl === null ? <span className="sf__placeholder">Imagem não disponível</span> : <img src={imageUrl} alt={image.altText ?? props.product.name} />}</div>{props.images.length > 1 ? <div className="sf__thumbs" aria-label="Imagens do produto">{props.images.map((item) => <button type="button" key={item.id} data-active={item.id === image?.id} onClick={() => { props.onImage(item.id); }} aria-label="Ver imagem"><img src={getCatalogPublicMediaUrl(props.product, item.objectKey)} alt={item.altText ?? props.product.name} loading="lazy" /></button>)}</div> : null}</div>;
}

function VariantOptions(props: Readonly<{ variants: ProductVariant[]; selectedId: string; trackInventory: boolean; showPrice: boolean; onSelect: (id: string) => void }>): React.JSX.Element | null {
  if (!props.variants.length) return null;
  return <fieldset className="sf__variants"><legend>Escolha uma opção</legend><div className="sf__variant-options">{props.variants.map((variant) => { const unavailable = props.trackInventory && variant.stockQuantity <= 0; const detail = unavailable ? "Indisponível" : props.showPrice ? storefrontMoney(variant.priceCents) : "Disponível"; return <button type="button" key={variant.id} className="sf__variant" data-selected={props.selectedId === variant.id} data-unavailable={unavailable} disabled={unavailable} onClick={() => { props.onSelect(variant.id); }}><span>{variantLabel(variant)}</span><small>{detail}</small></button>; })}</div></fieldset>;
}

function Quantity(props: Readonly<{ value: number; max: number; disabled: boolean; onChange: (value: number) => void }>): React.JSX.Element { const upper = Math.max(1, props.max); return <div className="sf__quantity-block"><span>Quantidade</span><div className="sf__qty sf__qty--large"><button type="button" disabled={props.disabled || props.value <= 1} onClick={() => { props.onChange(Math.max(1, props.value - 1)); }} aria-label="Diminuir quantidade">−</button><output aria-live="polite">{props.value}</output><button type="button" disabled={props.disabled || props.value >= upper} onClick={() => { props.onChange(Math.min(upper, props.value + 1)); }} aria-label="Aumentar quantidade">+</button></div></div>; }

export function ProductDetail(props: Readonly<ProductDetailProps>): React.JSX.Element {
  const [variantId, setVariantId] = useState(""); const [quantity, setQuantity] = useState(1); const [imageId, setImageId] = useState<string | null>(null);
  const selectedVariant = useMemo(() => props.product.variants.find((item) => item.id === variantId), [props.product.variants, variantId]);
  const selectedId = selectedVariant?.id ?? null; const images = useMemo(() => selectionImages(props.product, selectedId), [props.product, selectedId]);
  const hasVariants = props.product.variants.length > 0; const hasValidSelection = !hasVariants || selectedVariant !== undefined; const limit = stockLimit(props.product, selectedVariant); const available = hasValidSelection && limit > 0;
  const currentPrice = !hasVariants ? props.product.priceCents : selectedVariant === undefined ? null : resolvePurchasableSelection(props.product, selectedVariant.id).unitPriceCents;
  const compareAt = !hasVariants ? props.product.compareAtPriceCents : selectedVariant?.compareAtPriceCents ?? null;
  const promotional = currentPrice !== null && hasPromotionalPrice(currentPrice, compareAt);
  const mode = props.mode ?? "modal"; const showDescription = props.showDescription ?? true; const showSku = props.showSku ?? false; const showBuyButton = props.showBuyButton ?? true; const quantityEnabled = props.quantityEnabled ?? true; const catalogOnly = props.catalogOnly ?? false; const sku = selectedVariant?.sku ?? props.product.sku; const purchaseVisible = showBuyButton && !catalogOnly;
  function selectVariant(nextId: string): void { setVariantId(nextId); setQuantity(1); setImageId(null); }
  const content = <section className={mode === "page" ? "sf__product-layout" : "sf__modal"} aria-modal={mode === "modal" ? "true" : undefined} role={mode === "modal" ? "dialog" : undefined}>{mode === "modal" ? <div className="sf__modal-head"><span /><button className="sf__close" type="button" onClick={props.onClose} aria-label="Fechar">×</button></div> : null}<div className="sf__detail"><Gallery product={props.product} images={images} selectedImageId={imageId} onImage={setImageId} /><div className="sf__panel">{props.categoryName ? <p className="sf__eyebrow">{props.categoryName}</p> : null}<h1 className="sf__product-title">{props.product.name}</h1>{promotional && props.showPrice ? <PromotionBadge /> : null}<Price current={currentPrice} compareAt={compareAt} show={props.showPrice} />{showSku && sku ? <p className="sf__meta">Código: {sku}</p> : null}{props.showShare ? <ShareActions title={props.product.name} url={props.shareUrl} /> : null}{showDescription && props.product.description ? <p className="sf__description">{props.product.description}</p> : null}<VariantOptions variants={props.product.variants} selectedId={variantId} trackInventory={props.product.trackInventory} showPrice={props.showPrice} onSelect={selectVariant} />{selectedVariant !== undefined && Object.keys(selectedVariant.attributes).length > 0 ? <dl className="sf__attributes">{Object.entries(selectedVariant.attributes).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl> : null}{props.showStock && props.product.trackInventory && hasValidSelection ? <p className="sf__stock" data-available={available}>{available ? `Disponível${limit < 10 ? ` · ${String(limit)} em estoque` : ""}` : "Sem estoque"}</p> : null}{purchaseVisible && quantityEnabled ? <Quantity value={quantity} max={limit} disabled={!available} onChange={setQuantity} /> : null}{purchaseVisible ? <button className="sf__primary sf__add" type="button" disabled={!available} onClick={() => { props.onAdd(props.product, selectedId, quantityEnabled ? quantity : 1); }}>{!hasValidSelection ? "Escolha uma opção" : available ? "Adicionar ao carrinho" : "Indisponível"}</button> : null}{catalogOnly ? <p className="sf__meta">Este catálogo está em modo vitrine.</p> : null}</div></div></section>;
  if (mode === "page") return content;
  return <div className="sf__overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose?.(); }}>{content}</div>;
}
