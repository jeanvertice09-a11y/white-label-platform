import type { CatalogCardStyle, Product } from "@white-label/catalog";
import { getCatalogPublicMediaUrl, hasPromotionalPrice, isProductAvailable } from "@white-label/catalog";
import { storefrontProductPath } from "../../lib/storefront-paths.ts";
import { storefrontMoney } from "./format.ts";
import { PromotionBadge } from "./promotion-badge.tsx";

function cardPrice(product: Product): { current: number; compareAt: number | null; prefix: string } {
  if (!product.variants.length) return { current: product.priceCents, compareAt: product.compareAtPriceCents, prefix: "" };
  const variant = product.variants.reduce((lowest, item) => item.priceCents < lowest.priceCents ? item : lowest);
  return { current: variant.priceCents, compareAt: variant.compareAtPriceCents, prefix: "A partir de " };
}

export function ProductCard(props: Readonly<{
  product: Product;
  categoryName: string | null;
  showPrice: boolean;
  showDescription?: boolean;
  showSku?: boolean;
  cardStyle?: CatalogCardStyle;
}>): React.JSX.Element {
  const image = props.product.images.at(0);
  const imageUrl = image ? getCatalogPublicMediaUrl(props.product, image.objectKey) : null;
  const price = cardPrice(props.product);
  const promotional = hasPromotionalPrice(price.current, price.compareAt);
  const isAvailable = isProductAvailable(props.product);
  const cardStyle = props.cardStyle ?? "default";

  return <article className={`sf__product-card sf__product-card--${cardStyle}`}><a className="sf__product-link" href={storefrontProductPath(props.product.slug)} aria-label={`Ver ${props.product.name}`}><div className="sf__image">{imageUrl && image ? <img src={imageUrl} alt={image.altText ?? props.product.name} loading="lazy" /> : <span className="sf__placeholder">Imagem não disponível</span>}</div><div className="sf__card-body">{promotional && props.showPrice ? <PromotionBadge /> : null}{props.categoryName ? <span className="sf__meta">{props.categoryName}</span> : null}<h2 className="sf__product-name">{props.product.name}</h2>{props.showSku && props.product.sku ? <span className="sf__meta">Código: {props.product.sku}</span> : null}{props.showDescription && props.product.description ? <p className="sf__card-description">{props.product.description}</p> : null}{props.showPrice ? <div className="sf__price-line">{promotional ? <span className="sf__old-price">{storefrontMoney(price.compareAt ?? 0)}</span> : null}<span className="sf__price">{price.prefix}{storefrontMoney(price.current)}</span></div> : null}<div className="sf__card-foot">{props.product.variants.length ? <span>{String(props.product.variants.length)} opções</span> : <span>Ver produto</span>}{!isAvailable ? <span className="sf__availability">Indisponível</span> : null}</div></div></a></article>;
}
