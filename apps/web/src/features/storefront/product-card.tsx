import type { Product } from "@white-label/catalog";
import { getCatalogPublicMediaUrl } from "@white-label/catalog";
import { storefrontMoney } from "./format.ts";

export function ProductCard(props: Readonly<{
  product: Product;
  showPrice: boolean;
  onOpen: (product: Product) => void;
}>): React.JSX.Element {
  const image = props.product.images[0];
  const imageUrl = image
    ? getCatalogPublicMediaUrl(props.product, image.objectKey)
    : null;
  const minVariantPrice = props.product.variants.length
    ? Math.min(...props.product.variants.map((variant) => variant.priceCents))
    : props.product.priceCents;

  return (
    <button className="sf__card" type="button" onClick={() => { props.onOpen(props.product); }}>
      <div className="sf__image">
        {imageUrl ? (
          <img src={imageUrl} alt={image?.altText ?? props.product.name} loading="lazy" />
        ) : (
          <span className="sf__placeholder">Sem imagem</span>
        )}
      </div>
      <div className="sf__card-body">
        <span className="sf__product-name">{props.product.name}</span>
        {props.product.variants.length ? (
          <span className="sf__meta">{String(props.product.variants.length)} variantes</span>
        ) : null}
        {props.showPrice ? (
          <span className="sf__price">
            {props.product.variants.length ? "A partir de " : ""}
            {storefrontMoney(minVariantPrice)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
