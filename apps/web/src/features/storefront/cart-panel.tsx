import { useRef, useState } from "react";
import type { CartState } from "@white-label/catalog";
import { cartTotalCents, clearCart, removeCartItem, setCartItemQuantity } from "@white-label/catalog";
import { createWhatsappOrder } from "../../lib/server/storefront-checkout.functions.ts";
import { storefrontMoney } from "./format.ts";

type CheckoutResult = Awaited<ReturnType<typeof createWhatsappOrder>>;

function CartRows(props: Readonly<{ cart: CartState; onChange: (cart: CartState) => void }>): React.JSX.Element {
  function change(productId: string, variantId: string | null, next: number): void {
    props.onChange(next < 1 ? removeCartItem(props.cart, productId, variantId) : setCartItemQuantity(props.cart, productId, variantId, next));
  }
  if (!props.cart.items.length) return <div className="sf__empty">Seu carrinho está vazio.</div>;
  return <>{props.cart.items.map((item) => <div className="sf__cart-row" key={item.productId + ":" + (item.variantId ?? "base")}>
    <div><strong>{item.name}</strong>{item.variantName ? <div className="sf__meta">{item.variantName}</div> : null}<div className="sf__meta">{storefrontMoney(item.unitPriceCents)} cada</div><button type="button" onClick={() => { props.onChange(removeCartItem(props.cart, item.productId, item.variantId)); }}>Remover</button></div>
    <div className="sf__qty"><button type="button" onClick={() => { change(item.productId, item.variantId, item.quantity - 1); }}>−</button><span>{item.quantity}</span><button type="button" onClick={() => { change(item.productId, item.variantId, item.quantity + 1); }}>+</button></div>
  </div>)}</>;
}

function CheckoutFields(props: Readonly<{ name: string; phone: string; coupon: string; onName: (value: string) => void; onPhone: (value: string) => void; onCoupon: (value: string) => void }>): React.JSX.Element {
  return <>
    <label className="sf__field"><span>Nome</span><input value={props.name} onChange={(event) => { props.onName(event.target.value); }} placeholder="Seu nome" autoComplete="name" /></label>
    <label className="sf__field"><span>Telefone</span><input value={props.phone} onChange={(event) => { props.onPhone(event.target.value); }} placeholder="(62) 99999-9999" inputMode="tel" autoComplete="tel" /></label>
    <label className="sf__field"><span>Cupom</span><input value={props.coupon} onChange={(event) => { props.onCoupon(event.target.value.toUpperCase()); }} placeholder="PROMO10" /></label>
  </>;
}

function OrderSuccess({ result }: Readonly<{ result: CheckoutResult }>): React.JSX.Element {
  return <div className="sf__success">
    <div><span className="sf__success-mark">✓</span><h3>Pedido {result.displayNumber} registrado</h3><p className="sf__meta">Status: {result.status}. Agora você pode continuar pelo WhatsApp.</p></div>
    <div className="sf__order-items">{result.items.map((item, index) => <div className="sf__cart-row" key={`${item.productName}-${String(index)}`}><span>{item.quantity}× {item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</span><strong>{storefrontMoney(item.totalCents)}</strong></div>)}</div>
    <div className="sf__summary"><span>Subtotal <strong>{storefrontMoney(result.subtotalCents)}</strong></span>{result.discountCents > 0 ? <span>Desconto <strong>− {storefrontMoney(result.discountCents)}</strong></span> : null}<span>Total <strong>{storefrontMoney(result.totalCents)}</strong></span></div>
    <a className="sf__primary" href={result.whatsappUrl}>Abrir WhatsApp</a>
  </div>;
}

function safeCheckoutMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.toLowerCase().includes("cupom") || message.toLowerCase().includes("carrinho")) {
    return "Não foi possível concluir. Confira itens, estoque e o cupom (código, validade, subtotal mínimo e limite de uso).";
  }
  return message || "Não foi possível registrar o pedido.";
}

export function CartPanel(props: Readonly<{ cart: CartState; whatsappEnabled: boolean; onChange: (cart: CartState) => void; onClose: () => void }>): React.JSX.Element {
  const key = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<CheckoutResult | null>(null);

  async function checkout(): Promise<void> {
    setBusy(true); setMessage("");
    try {
      key.current ??= crypto.randomUUID();
      const result = await createWhatsappOrder({ data: {
        idempotencyKey: key.current,
        customerName: name.trim() || null,
        customerPhone: phone.trim() || null,
        couponCode: coupon.trim() || null,
        items: props.cart.items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
      } });
      setSuccess(result);
      props.onChange(clearCart(props.cart));
    } catch (error) { setMessage(safeCheckoutMessage(error)); } finally { setBusy(false); }
  }

  return <div className="sf__overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section className="sf__modal" aria-modal="true" role="dialog">
      <div className="sf__modal-head"><h2 style={{ margin: 0 }}>{success ? "Pedido confirmado" : "Carrinho"}</h2><button className="sf__close" type="button" onClick={props.onClose} aria-label="Fechar">×</button></div>
      {success ? <OrderSuccess result={success} /> : <><div className="sf__cart"><CartRows cart={props.cart} onChange={props.onChange} /></div>{props.cart.items.length ? <div className="sf__checkout">
        <button type="button" onClick={() => { props.onChange(clearCart(props.cart)); }}>Limpar carrinho</button>
        <CheckoutFields name={name} phone={phone} coupon={coupon} onName={setName} onPhone={setPhone} onCoupon={setCoupon} />
        <div className="sf__total"><span>Subtotal visual</span><span>{storefrontMoney(cartTotalCents(props.cart))}</span></div>
        <div className="sf__meta">Preço, estoque, cupom, desconto e total são recalculados no servidor antes da persistência.</div>
        {message ? <div className="sf__checkout-error">{message}</div> : null}
        {props.whatsappEnabled ? <button className="sf__primary" disabled={busy} type="button" onClick={() => { void checkout(); }}>{busy ? "Registrando pedido…" : "Registrar pedido"}</button> : <div className="sf__checkout-error">Nenhum método de checkout público está disponível nesta loja.</div>}
      </div> : null}</>}
    </section>
  </div>;
}
