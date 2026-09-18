import { useRef, useState } from "react";
import type { CartState } from "@white-label/catalog";
import {
  cartTotalCents,
  clearCart,
  removeCartItem,
  setCartItemQuantity,
} from "@white-label/catalog";
import { createWhatsappOrder } from "../../lib/server/storefront-checkout.functions.ts";
import { storefrontMoney } from "./format.ts";

function CartRows(props: Readonly<{
  cart: CartState;
  onChange: (cart: CartState) => void;
}>): React.JSX.Element {
  function change(productId: string, variantId: string | null, next: number): void {
    props.onChange(next < 1
      ? removeCartItem(props.cart, productId, variantId)
      : setCartItemQuantity(props.cart, productId, variantId, next));
  }
  function remove(productId: string, variantId: string | null): void {
    props.onChange(removeCartItem(props.cart, productId, variantId));
  }
  if (!props.cart.items.length) return <div className="sf__empty">Seu carrinho está vazio.</div>;
  return <>{props.cart.items.map((item) => (
    <div className="sf__cart-row" key={item.productId + ":" + (item.variantId ?? "base")}>
      <div>
        <strong>{item.name}</strong>
        {item.variantName ? <div className="sf__meta">{item.variantName}</div> : null}
        <div className="sf__meta">{storefrontMoney(item.unitPriceCents)} cada</div>
        <button type="button" onClick={() => { remove(item.productId, item.variantId); }}>Remover</button>
      </div>
      <div className="sf__qty">
        <button type="button" onClick={() => { change(item.productId, item.variantId, item.quantity - 1); }}>−</button>
        <span>{item.quantity}</span>
        <button type="button" onClick={() => { change(item.productId, item.variantId, item.quantity + 1); }}>+</button>
      </div>
    </div>
  ))}</>;
}

function CheckoutFields(props: Readonly<{
  name: string;
  phone: string;
  coupon: string;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  onCoupon: (value: string) => void;
}>): React.JSX.Element {
  return (
    <>
      <label className="sf__field"><span>Nome</span><input value={props.name} onChange={(event) => { props.onName(event.target.value); }} placeholder="Seu nome" /></label>
      <label className="sf__field"><span>Telefone</span><input value={props.phone} onChange={(event) => { props.onPhone(event.target.value); }} placeholder="(62) 99999-9999" inputMode="tel" /></label>
      <label className="sf__field"><span>Cupom</span><input value={props.coupon} onChange={(event) => { props.onCoupon(event.target.value.toUpperCase()); }} placeholder="PROMO10" /></label>
    </>
  );
}

export function CartPanel(props: Readonly<{
  cart: CartState;
  whatsappEnabled: boolean;
  onChange: (cart: CartState) => void;
  onClose: () => void;
}>): React.JSX.Element {
  const key = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function checkout(): Promise<void> {
    setBusy(true);
    setMessage("");
    try {
      key.current ??= crypto.randomUUID();
      const result = await createWhatsappOrder({ data: {
        idempotencyKey: key.current,
        customerName: name.trim() || null,
        customerPhone: phone.trim() || null,
        couponCode: coupon.trim() || null,
        items: props.cart.items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
      } });
      setMessage(`Pedido ${result.displayNumber} registrado. Total ${storefrontMoney(result.totalCents)}.`);
      window.location.assign(result.whatsappUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar o pedido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sf__overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) props.onClose();
    }}>
      <section className="sf__modal" aria-modal="true" role="dialog">
        <div className="sf__modal-head"><h2 style={{ margin: 0 }}>Carrinho</h2><button className="sf__close" type="button" onClick={props.onClose}>×</button></div>
        <div className="sf__cart"><CartRows cart={props.cart} onChange={props.onChange} /></div>
        {props.cart.items.length ? (
          <div className="sf__checkout">
            <button type="button" onClick={() => { props.onChange(clearCart(props.cart)); }}>Limpar carrinho</button>
            <CheckoutFields name={name} phone={phone} coupon={coupon} onName={setName} onPhone={setPhone} onCoupon={setCoupon} />
            <div className="sf__total"><span>Subtotal do carrinho</span><span>{storefrontMoney(cartTotalCents(props.cart))}</span></div>
            <div className="sf__meta">Preço, cupom e total são recalculados no servidor antes do pedido ser criado.</div>
            {message ? <div className="sf__meta">{message}</div> : null}
            {props.whatsappEnabled ? <button className="sf__primary" disabled={busy} type="button" onClick={() => { void checkout(); }}>{busy ? "Registrando pedido…" : "Registrar e abrir WhatsApp"}</button> : <div className="sf__meta">Checkout por WhatsApp não está disponível nesta loja.</div>}
          </div>
        ) : null}
      </section>
    </div>
  );
}
