import type { CartState } from "@white-label/catalog";
import {
  buildWhatsappCheckoutUrl,
  cartTotalCents,
  removeCartItem,
  setCartItemQuantity,
} from "@white-label/catalog";
import { storefrontMoney } from "./format.ts";

export function CartPanel(props: Readonly<{
  cart: CartState;
  phone: string | null;
  intro: string;
  onChange: (cart: CartState) => void;
  onClose: () => void;
}>): React.JSX.Element {
  const checkoutUrl = props.phone && props.cart.items.length
    ? buildWhatsappCheckoutUrl(props.phone, props.cart, props.intro)
    : null;

  function changeQuantity(productId: string, variantId: string | null, next: number): void {
    if (next < 1) {
      props.onChange(removeCartItem(props.cart, productId, variantId));
      return;
    }
    props.onChange(setCartItemQuantity(props.cart, productId, variantId, next));
  }

  return (
    <div className="sf__overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) props.onClose();
    }}>
      <section className="sf__modal" aria-modal="true" role="dialog">
        <div className="sf__modal-head"><h2 style={{ margin: 0 }}>Carrinho</h2><button className="sf__close" type="button" onClick={props.onClose}>×</button></div>
        <div className="sf__cart">
          {props.cart.items.length ? props.cart.items.map((item) => (
            <div className="sf__cart-row" key={item.productId + ":" + (item.variantId ?? "base")}>
              <div><strong>{item.name}</strong>{item.variantName ? <div className="sf__meta">{item.variantName}</div> : null}<div className="sf__meta">{storefrontMoney(item.unitPriceCents)} cada</div></div>
              <div className="sf__qty">
                <button type="button" onClick={() => { changeQuantity(item.productId, item.variantId, item.quantity - 1); }}>−</button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => { changeQuantity(item.productId, item.variantId, item.quantity + 1); }}>+</button>
              </div>
            </div>
          )) : <div className="sf__empty">Seu carrinho está vazio.</div>}
        </div>
        {props.cart.items.length ? (
          <div className="sf__checkout">
            <div className="sf__total"><span>Total</span><span>{storefrontMoney(cartTotalCents(props.cart))}</span></div>
            {checkoutUrl ? <a className="sf__primary" href={checkoutUrl} target="_blank" rel="noreferrer">Finalizar pelo WhatsApp</a> : <div className="sf__meta">WhatsApp ainda não configurado para esta loja.</div>}
          </div>
        ) : null}
      </section>
    </div>
  );
}
