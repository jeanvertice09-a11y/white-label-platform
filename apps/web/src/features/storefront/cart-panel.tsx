import { useRef, useState } from "react";
import type { CartState } from "@white-label/catalog";
import {
  cartTotalCents,
  removeCartItem,
  setCartItemQuantity,
} from "@white-label/catalog";
import { createWhatsappOrder } from "../../lib/server/storefront-checkout.functions.ts";
import { storefrontMoney } from "./format.ts";

export function CartPanel(props: Readonly<{
  cart: CartState;
  whatsappEnabled: boolean;
  onChange: (cart: CartState) => void;
  onClose: () => void;
}>): React.JSX.Element {
  const idempotencyKey = useRef<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function changeQuantity(productId: string, variantId: string | null, next: number): void {
    if (next < 1) {
      props.onChange(removeCartItem(props.cart, productId, variantId));
      return;
    }
    props.onChange(setCartItemQuantity(props.cart, productId, variantId, next));
  }

  async function checkout(): Promise<void> {
    if (!props.whatsappEnabled || props.cart.items.length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const result = await createWhatsappOrder({ data: {
        idempotencyKey: idempotencyKey.current,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        couponCode: couponCode.trim() || null,
        items: props.cart.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
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
            <label className="sf__field"><span>Nome</span><input value={customerName} onChange={(event) => { setCustomerName(event.target.value); }} placeholder="Seu nome" /></label>
            <label className="sf__field"><span>Telefone</span><input value={customerPhone} onChange={(event) => { setCustomerPhone(event.target.value); }} placeholder="(62) 99999-9999" inputMode="tel" /></label>
            <label className="sf__field"><span>Cupom</span><input value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); }} placeholder="PROMO10" /></label>
            <div className="sf__total"><span>Subtotal do carrinho</span><span>{storefrontMoney(cartTotalCents(props.cart))}</span></div>
            <div className="sf__meta">Preço, cupom e total são recalculados no servidor antes do pedido ser criado.</div>
            {message ? <div className="sf__meta">{message}</div> : null}
            {props.whatsappEnabled ? (
              <button className="sf__primary" disabled={busy} type="button" onClick={() => { void checkout(); }}>
                {busy ? "Registrando pedido…" : "Registrar e abrir WhatsApp"}
              </button>
            ) : <div className="sf__meta">Checkout por WhatsApp não está disponível nesta loja.</div>}
          </div>
        ) : null}
      </section>
    </div>
  );
}
