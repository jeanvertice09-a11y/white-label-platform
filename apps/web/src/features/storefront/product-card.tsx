import type { Product } from "@white-label/catalog";
import { getCatalogPublicMediaUrl } from "@white-label/catalog";
import { storefrontProductPath } from "../../lib/storefront-paths.ts";
import { storefrontMoney } from "./format.ts";

function cardPrice(product: Product): { current: number; compareAt: number | null; prefix: string } {
  if (!product.variants.length) {
    return { current: product.priceCents, compareAt: product.compareAtPriceCents, prefix: "" };
  }
  const variant = product.variants.reduce((lowest, item) => item.priceCents < lowest.priceCents ? item : lowest);
  return { current: variant.priceCents, compareAt: variant.compareAtPriceCents, prefix: "A partir de " };
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
}>): React.JSX.Element {
  const image = props.product.images.at(0);
  const imageUrl = image ? getCatalogPublicMediaUrl(props.product, image.objectKey) : null;
  const price = cardPrice(props.product);
  const promotional = price.compareAt !== null && price.compareAt > price.current;
  const isAvailable = available(props.product);

  return <article className="sf__product-card">
    <a className="sf__product-link" href={storefrontProductPath(props.product.slug)} aria-label={`Ver ${props.product.name}`}>
      <div className="sf__image">
        {imageUrl && image
          ? <img src={imageUrl} alt={image.altText ?? props.product.name} loading="lazy" />
          : <span className="sf__placeholder">Imagem não disponível</span>}
      </div>
      <div className="sf__card-body">
        {props.categoryName ? <span className="sf__meta">{props.categoryName}</span> : null}
        <h2 className="sf__product-name">{props.product.name}</h2>
        {props.showPrice ? <div className="sf__price-line">
          {promotional ? <span className="sf__old-price">{storefrontMoney(price.compareAt ?? 0)}</span> : null}
          <span className="sf__price">{price.prefix}{storefrontMoney(price.current)}</span>
        </div> : null}
        <div className="sf__card-foot">
          {props.product.variants.length ? <span>{String(props.product.variants.length)} opções</span> : <span>Ver produto</span>}
          {!isAvailable ? <span className="sf__availability">Indisponível</span> : null}
        </div>
      </div>
    </a>
  </article>;
}
