import type { Product } from "@white-label/catalog";
import { getCatalogPublicMediaUrl } from "@white-label/catalog";
import { storefrontMoney } from "./format.ts";

function cardPrice(product: Product): {
  current: number;
  compareAt: number | null;
  prefix: string;
} {
  if (!product.variants.length) {
    return {
      current: product.priceCents,
      compareAt: product.compareAtPriceCents,
      prefix: "",
    };
  }
  const variant = product.variants.reduce((lowest, item) =>
    item.priceCents < lowest.priceCents ? item : lowest,
  );
  return {
    current: variant.priceCents,
    compareAt: variant.compareAtPriceCents,
    prefix: "A partir de ",
  };
}

function available(product: Product): boolean {
  if (!product.trackInventory) return true;
  if (!product.variants.length) return product.stockQuantity > 0;
  return product.variants.some((variant) => variant.stockQuantity > 0);
}

export function ProductCard(props: Readonly<{
  product: Product;
  categoryName: string | null;
  showPrice: boolean;
  onOpen: (product: Product) => void;
}>): React.JSX.Element {
  const image = props.product.images.at(0);
  const imageUrl = image
    ? getCatalogPublicMediaUrl(props.product, image.objectKey)
    : null;
  const price = cardPrice(props.product);
  const promotional = price.compareAt !== null && price.compareAt > price.current;
  const isAvailable = available(props.product);

  return (
    <button className="sf__card" type="button" onClick={() => { props.onOpen(props.product); }}>
      <div className="sf__image">
        {imageUrl && image ? (
          <img src={imageUrl} alt={image.altText ?? props.product.name} loading="lazy" />
        ) : (
          <span className="sf__placeholder">Sem imagem</span>
        )}
      </div>
      <div className="sf__card-body">
        {props.categoryName ? <span className="sf__meta">{props.categoryName}</span> : null}
        <span className="sf__product-name">{props.product.name}</span>
        {props.product.variants.length ? (
          <span className="sf__meta">{String(props.product.variants.length)} variantes</span>
        ) : null}
        {!isAvailable ? <span className="sf__availability">Indisponível</span> : null}
        {props.showPrice ? (
          <span className="sf__price-line">
            {promotional ? <span className="sf__old-price">{storefrontMoney(price.compareAt ?? 0)}</span> : null}
            <span className="sf__price">{price.prefix}{storefrontMoney(price.current)}</span>
          </span>
        ) : null}
      </div>
    </button>
  );
}
