import { useEffect, useRef, useState } from "react";
import type { CatalogAdvancedSettings, CartState } from "@white-label/catalog";
import { cartTotalCents, clearCart, removeCartItem, setCartItemQuantity } from "@white-label/catalog";
import { createWhatsappOrder, refreshPublicCart } from "../../lib/server/storefront-checkout.functions.ts";
import { storefrontMoney } from "./format.ts";
import { trackStorefrontEvent } from "./storefront-tracking.tsx";

type CheckoutResult = Awaited<ReturnType<typeof createWhatsappOrder>>;
type RefreshResult = Awaited<ReturnType<typeof refreshPublicCart>>;
type CheckoutSettings = Pick<CatalogAdvancedSettings, "checkoutAskName" | "checkoutAskPhone" | "checkoutAskNotes" | "minimumOrderCents">;
const MAX_CART_QUANTITY = 999;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function cartKey(productId: string, variantId: string | null): string { return `${productId}:${variantId ?? "base"}`; }
function refreshInput(cart: CartState) { return cart.items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })); }

function reconcileCart(cart: CartState, result: RefreshResult): { cart: CartState; changed: boolean; notice: string } {
  const previous = new Map(cart.items.map((item) => [cartKey(item.productId, item.variantId), item]));
  let removed = result.items.length !== cart.items.length; let quantityChanged = false; let priceChanged = false; let descriptionChanged = false;
  for (const item of result.items) {
    const before = previous.get(cartKey(item.productId, item.variantId));
    if (!before) { removed = true; continue; }
    if (before.quantity !== item.quantity) quantityChanged = true;
    if (before.unitPriceCents !== item.unitPriceCents) priceChanged = true;
    if (before.name !== item.name || before.variantName !== item.variantName) descriptionChanged = true;
  }
  const changed = removed || quantityChanged || priceChanged || descriptionChanged;
  const notice = removed ? "Um produto ou variante indisponível foi removido do carrinho." : quantityChanged ? "A quantidade foi ajustada ao estoque/configuração atual." : priceChanged ? "Um preço mudou e o carrinho foi atualizado. Revise antes de confirmar." : descriptionChanged ? "Um item do carrinho foi atualizado. Revise antes de confirmar." : "";
  return { cart: { ...cart, items: result.items }, changed, notice };
}

function trackingItems(cart: CartState) {
  return cart.items.map((item) => ({ id: item.productId, name: item.name, variantName: item.variantName, quantity: item.quantity, unitPriceCents: item.unitPriceCents }));
}

function CartRows(props: Readonly<{ cart: CartState; showPrice: boolean; quantityEnabled: boolean; onChange: (cart: CartState) => void }>): React.JSX.Element {
  function change(productId: string, variantId: string | null, next: number): void {
    if (next > MAX_CART_QUANTITY) return;
    props.onChange(next < 1 ? removeCartItem(props.cart, productId, variantId) : setCartItemQuantity(props.cart, productId, variantId, next));
  }
  if (!props.cart.items.length) return <div className="sf__empty sf__empty--cart"><strong>Seu carrinho está vazio</strong><span>Escolha um produto para iniciar seu pedido.</span></div>;
  return <div className="sf__cart-list">{props.cart.items.map((item) => <article className="sf__cart-row" key={item.productId + ":" + (item.variantId ?? "base")}><div className="sf__cart-copy"><strong>{item.name}</strong>{item.variantName ? <span className="sf__meta">{item.variantName}</span> : null}{props.showPrice ? <span className="sf__meta">{storefrontMoney(item.unitPriceCents)} cada</span> : null}<button className="sf__text-button" type="button" onClick={() => { props.onChange(removeCartItem(props.cart, item.productId, item.variantId)); }}>Remover</button></div><div className="sf__cart-side">{props.showPrice ? <strong>{storefrontMoney(item.unitPriceCents * item.quantity)}</strong> : null}{props.quantityEnabled ? <div className="sf__qty"><button type="button" onClick={() => { change(item.productId, item.variantId, item.quantity - 1); }} aria-label="Diminuir quantidade">−</button><span>{item.quantity}</span><button type="button" disabled={item.quantity >= MAX_CART_QUANTITY} onClick={() => { change(item.productId, item.variantId, item.quantity + 1); }} aria-label="Aumentar quantidade">+</button></div> : <span className="sf__meta">Qtd. {item.quantity}</span>}</div></article>)}</div>;
}

function CheckoutFields(props: Readonly<{ settings: CheckoutSettings; name: string; phone: string; coupon: string; notes: string; onName: (value: string) => void; onPhone: (value: string) => void; onCoupon: (value: string) => void; onNotes: (value: string) => void }>): React.JSX.Element {
  const asksIdentity = props.settings.checkoutAskName || props.settings.checkoutAskPhone || props.settings.checkoutAskNotes;
  return <div className="sf__checkout-fields">{asksIdentity ? <div className="sf__checkout-section-head"><span>Seus dados</span><small>Usados somente no pedido.</small></div> : null}
    {props.settings.checkoutAskName ? <label className="sf__field"><span>Nome</span><input value={props.name} onChange={(event) => { props.onName(event.target.value); }} placeholder="Seu nome" autoComplete="name" /></label> : null}
    {props.settings.checkoutAskPhone ? <label className="sf__field"><span>Telefone</span><input value={props.phone} onChange={(event) => { props.onPhone(event.target.value); }} placeholder="(62) 99999-9999" inputMode="tel" autoComplete="tel" /></label> : null}
    <label className="sf__field sf__coupon"><span>Cupom <small>opcional</small></span><input value={props.coupon} onChange={(event) => { props.onCoupon(event.target.value.toUpperCase()); }} placeholder="Digite o código" autoCapitalize="characters" /></label>
    {props.settings.checkoutAskNotes ? <label className="sf__field"><span>Observação <small>opcional</small></span><textarea value={props.notes} maxLength={1000} onChange={(event) => { props.onNotes(event.target.value); }} placeholder="Alguma observação sobre o pedido?" /></label> : null}
  </div>;
}

function OrderSuccess({ result, showPrice }: Readonly<{ result: CheckoutResult; showPrice: boolean }>): React.JSX.Element {
  return <div className="sf__success"><div className="sf__confirmation-head"><span className="sf__success-mark" aria-hidden="true">✓</span><div><span className="sf__eyebrow">Pedido registrado</span><h3>{result.displayNumber}</h3><p>Seu pedido já foi criado. O WhatsApp é o próximo passo para continuar o atendimento.</p></div></div><div className="sf__order-items">{result.items.map((item, index) => <div className="sf__summary-row" key={`${item.productName}-${String(index)}`}><span>{item.quantity}× {item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</span>{showPrice ? <strong>{storefrontMoney(item.totalCents)}</strong> : null}</div>)}</div>{showPrice ? <div className="sf__summary"><div className="sf__summary-row"><span>Subtotal</span><strong>{storefrontMoney(result.subtotalCents)}</strong></div>{result.discountCents > 0 ? <div className="sf__summary-row"><span>Desconto</span><strong>− {storefrontMoney(result.discountCents)}</strong></div> : null}<div className="sf__summary-row sf__summary-row--total"><span>Total</span><strong>{storefrontMoney(result.totalCents)}</strong></div></div> : null}<a className="sf__primary" href={result.whatsappUrl}>Continuar no WhatsApp</a></div>;
}

function safeCheckoutMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.toLowerCase().includes("pedido mínimo")) return "O subtotal atual ainda não atingiu o pedido mínimo desta loja.";
  if (message.toLowerCase().includes("cupom")) return "Confira o código, a validade, o subtotal mínimo e o limite de uso do cupom.";
  if (message.toLowerCase().includes("carrinho") || message.toLowerCase().includes("estoque")) return "Um item mudou de disponibilidade. Revise o carrinho e tente novamente.";
  if (message.toLowerCase().includes("desativ") || message.toLowerCase().includes("indisponível") || message.toLowerCase().includes("quantidade")) return "O catálogo mudou de configuração. Revise o carrinho e tente novamente.";
  return message || "Não foi possível registrar o pedido.";
}

export function CartPanel(props: Readonly<{ cart: CartState; whatsappEnabled: boolean; showPrice?: boolean; quantityEnabled?: boolean; checkoutSettings: CheckoutSettings; onChange: (cart: CartState) => void; onClose: () => void }>): React.JSX.Element {
  const key = useRef<string | null>(null); const initialCart = useRef(props.cart); const initialOnChange = useRef(props.onChange); const dialogRef = useRef<HTMLElement | null>(null); const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [coupon, setCoupon] = useState(""); const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false); const [refreshing, setRefreshing] = useState(false); const [message, setMessage] = useState(""); const [success, setSuccess] = useState<CheckoutResult | null>(null); const [minimumOrderCents, setMinimumOrderCents] = useState(props.checkoutSettings.minimumOrderCents);
  const showPrice = props.showPrice ?? true; const quantityEnabled = props.quantityEnabled ?? true; const subtotal = cartTotalCents(props.cart); const minimumMet = subtotal >= minimumOrderCents;
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>(".sf__close")?.focus();
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, []);
  useEffect(() => {
    let active = true; const cart = initialCart.current;
    if (!cart.items.length) return () => { active = false; };
    setRefreshing(true);
    void refreshPublicCart({ data: { items: refreshInput(cart) } }).then((result) => {
      if (!active) return;
      setMinimumOrderCents(result.minimumOrderCents);
      const reconciled = reconcileCart(cart, result);
      if (reconciled.changed) { initialOnChange.current(reconciled.cart); setMessage(reconciled.notice); }
    }).catch((error: unknown) => { if (active) setMessage(safeCheckoutMessage(error)); }).finally(() => { if (active) setRefreshing(false); });
    return () => { active = false; };
  }, []);
  async function checkout(): Promise<void> {
    setBusy(true); setMessage("");
    try {
      const refreshed = await refreshPublicCart({ data: { items: refreshInput(props.cart) } }); setMinimumOrderCents(refreshed.minimumOrderCents); const reconciled = reconcileCart(props.cart, refreshed);
      if (reconciled.changed) { props.onChange(reconciled.cart); setMessage(reconciled.notice || "O carrinho foi atualizado. Revise antes de confirmar."); return; }
      if (refreshed.subtotalCents < refreshed.minimumOrderCents) { setMessage("O subtotal atual ainda não atingiu o pedido mínimo desta loja."); return; }
      trackStorefrontEvent({ type: "begin_checkout", items: trackingItems(reconciled.cart) }); key.current ??= crypto.randomUUID();
      const result = await createWhatsappOrder({ data: { idempotencyKey: key.current, customerName: props.checkoutSettings.checkoutAskName ? name.trim() || null : null, customerPhone: props.checkoutSettings.checkoutAskPhone ? phone.trim() || null : null, couponCode: coupon.trim() || null, notes: props.checkoutSettings.checkoutAskNotes ? notes.trim() || null : null, items: refreshInput(reconciled.cart) } });
      setSuccess(result); props.onChange(clearCart(reconciled.cart)); trackStorefrontEvent({ type: "order_created", orderId: result.orderId, totalCents: result.totalCents, items: result.items.flatMap((item) => item.productId ? [{ id: item.productId, name: item.productName, variantName: item.variantName, quantity: item.quantity, unitPriceCents: item.unitCents }] : []) });
    } catch (error) { setMessage(safeCheckoutMessage(error)); } finally { setBusy(false); }
  }
  return <div className="sf__overlay sf__overlay--drawer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}><section ref={dialogRef} className="sf__modal sf__cart-modal" aria-modal="true" role="dialog" aria-label={success ? "Confirmação do pedido" : "Carrinho e checkout"}><div className="sf__modal-head"><div><span className="sf__eyebrow">{success ? "Confirmação" : "Seu pedido"}</span><h2>{success ? "Pedido confirmado" : "Carrinho"}</h2></div><button className="sf__close" type="button" onClick={props.onClose} aria-label="Fechar">×</button></div>{success ? <OrderSuccess result={success} showPrice={showPrice} /> : <><CartRows cart={props.cart} showPrice={showPrice} quantityEnabled={quantityEnabled} onChange={props.onChange} />{props.cart.items.length ? <div className="sf__checkout"><CheckoutFields settings={props.checkoutSettings} name={name} phone={phone} coupon={coupon} notes={notes} onName={setName} onPhone={setPhone} onCoupon={setCoupon} onNotes={setNotes} /><div className="sf__summary">{showPrice ? <div className="sf__summary-row sf__summary-row--total"><span>Subtotal</span><strong>{storefrontMoney(subtotal)}</strong></div> : null}{minimumOrderCents > 0 ? <p className="sf__minimum-order" data-met={minimumMet}>Pedido mínimo: {storefrontMoney(minimumOrderCents)}{minimumMet ? " · atingido" : ""}</p> : null}<p>Estoque, preço, cupom, desconto, pedido mínimo e total são validados novamente no servidor antes de o pedido ser criado.</p></div>{message ? <div className="sf__checkout-error" role="alert">{message}</div> : null}<div className="sf__checkout-actions"><button className="sf__text-button" type="button" onClick={() => { props.onChange(clearCart(props.cart)); }}>Limpar carrinho</button>{props.whatsappEnabled ? <button className="sf__primary" disabled={busy || refreshing || !minimumMet} type="button" onClick={() => { void checkout(); }}>{busy || refreshing ? "Atualizando carrinho…" : minimumMet ? "Confirmar pedido" : "Pedido mínimo não atingido"}</button> : <div className="sf__checkout-error">Nenhum método de checkout público está disponível nesta loja.</div>}</div></div> : null}</>}</section></div>;
}
