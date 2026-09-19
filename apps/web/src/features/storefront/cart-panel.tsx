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
  if (!props.cart.items.length) return <div className="sf__empty sf__empty--cart"><strong>Seu carrinho está vazio</strong><span>Escolha um produto para iniciar seu pedido.</span></div>;
  return <div className="sf__cart-list">{props.cart.items.map((item) => <article className="sf__cart-row" key={item.productId + ":" + (item.variantId ?? "base")}>
    <div className="sf__cart-copy"><strong>{item.name}</strong>{item.variantName ? <span className="sf__meta">{item.variantName}</span> : null}<span className="sf__meta">{storefrontMoney(item.unitPriceCents)} cada</span><button className="sf__text-button" type="button" onClick={() => { props.onChange(removeCartItem(props.cart, item.productId, item.variantId)); }}>Remover</button></div>
    <div className="sf__cart-side"><strong>{storefrontMoney(item.unitPriceCents * item.quantity)}</strong><div className="sf__qty"><button type="button" onClick={() => { change(item.productId, item.variantId, item.quantity - 1); }} aria-label="Diminuir quantidade">−</button><span>{item.quantity}</span><button type="button" onClick={() => { change(item.productId, item.variantId, item.quantity + 1); }} aria-label="Aumentar quantidade">+</button></div></div>
  </article>)}</div>;
}

function CheckoutFields(props: Readonly<{ name: string; phone: string; coupon: string; onName: (value: string) => void; onPhone: (value: string) => void; onCoupon: (value: string) => void }>): React.JSX.Element {
  return <div className="sf__checkout-fields">
    <div className="sf__checkout-section-head"><span>Seus dados</span><small>Usados para identificar o pedido.</small></div>
    <label className="sf__field"><span>Nome</span><input value={props.name} onChange={(event) => { props.onName(event.target.value); }} placeholder="Seu nome" autoComplete="name" /></label>
    <label className="sf__field"><span>Telefone</span><input value={props.phone} onChange={(event) => { props.onPhone(event.target.value); }} placeholder="(62) 99999-9999" inputMode="tel" autoComplete="tel" /></label>
    <label className="sf__field sf__coupon"><span>Cupom <small>opcional</small></span><input value={props.coupon} onChange={(event) => { props.onCoupon(event.target.value.toUpperCase()); }} placeholder="Digite o código" autoCapitalize="characters" /></label>
  </div>;
}

function OrderSuccess({ result }: Readonly<{ result: CheckoutResult }>): React.JSX.Element {
  return <div className="sf__success">
    <div className="sf__confirmation-head"><span className="sf__success-mark" aria-hidden="true">✓</span><div><span className="sf__eyebrow">Pedido registrado</span><h3>{result.displayNumber}</h3><p>Seu pedido já foi criado. O WhatsApp é o próximo passo para continuar o atendimento.</p></div></div>
    <div className="sf__order-items">{result.items.map((item, index) => <div className="sf__summary-row" key={`${item.productName}-${String(index)}`}><span>{item.quantity}× {item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</span><strong>{storefrontMoney(item.totalCents)}</strong></div>)}</div>
    <div className="sf__summary"><div className="sf__summary-row"><span>Subtotal</span><strong>{storefrontMoney(result.subtotalCents)}</strong></div>{result.discountCents > 0 ? <div className="sf__summary-row"><span>Desconto</span><strong>− {storefrontMoney(result.discountCents)}</strong></div> : null}<div className="sf__summary-row sf__summary-row--total"><span>Total</span><strong>{storefrontMoney(result.totalCents)}</strong></div></div>
    <a className="sf__primary" href={result.whatsappUrl}>Continuar no WhatsApp</a>
  </div>;
}

function safeCheckoutMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.toLowerCase().includes("cupom")) return "Confira o código, a validade, o subtotal mínimo e o limite de uso do cupom.";
  if (message.toLowerCase().includes("carrinho") || message.toLowerCase().includes("estoque")) return "Um item mudou de disponibilidade. Revise o carrinho e tente novamente.";
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

  return <div className="sf__overlay sf__overlay--drawer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section className="sf__modal sf__cart-modal" aria-modal="true" role="dialog" aria-label={success ? "Confirmação do pedido" : "Carrinho e checkout"}>
      <div className="sf__modal-head"><div><span className="sf__eyebrow">{success ? "Confirmação" : "Seu pedido"}</span><h2>{success ? "Pedido confirmado" : "Carrinho"}</h2></div><button className="sf__close" type="button" onClick={props.onClose} aria-label="Fechar">×</button></div>
      {success ? <OrderSuccess result={success} /> : <>
        <CartRows cart={props.cart} onChange={props.onChange} />
        {props.cart.items.length ? <div className="sf__checkout">
          <CheckoutFields name={name} phone={phone} coupon={coupon} onName={setName} onPhone={setPhone} onCoupon={setCoupon} />
          <div className="sf__summary"><div className="sf__summary-row sf__summary-row--total"><span>Subtotal</span><strong>{storefrontMoney(cartTotalCents(props.cart))}</strong></div><p>Estoque, preço, cupom, desconto e total são validados novamente no servidor antes de o pedido ser criado.</p></div>
          {message ? <div className="sf__checkout-error" role="alert">{message}</div> : null}
          <div className="sf__checkout-actions"><button className="sf__text-button" type="button" onClick={() => { props.onChange(clearCart(props.cart)); }}>Limpar carrinho</button>{props.whatsappEnabled ? <button className="sf__primary" disabled={busy} type="button" onClick={() => { void checkout(); }}>{busy ? "Criando pedido…" : "Confirmar pedido"}</button> : <div className="sf__checkout-error">Nenhum método de checkout público está disponível nesta loja.</div>}</div>
        </div> : null}
      </>}
    </section>
  </div>;
}
