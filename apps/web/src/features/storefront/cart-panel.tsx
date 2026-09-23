/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-confusing-void-expression,@typescript-eslint/use-unknown-in-catch-callback-variable */
import { useEffect, useRef, useState } from "react";
import type { CatalogAdvancedSettings, CartState } from "@white-label/catalog";
import { cartTotalCents, clearCart, removeCartItem, setCartItemQuantity } from "@white-label/catalog";
import { createOnlinePixOrder, createWhatsappOrder, getOnlinePixOrderStatus, refreshPublicCart } from "../../lib/server/storefront-checkout.functions.ts";
import { storefrontMoney } from "./format.ts";
import { trackStorefrontEvent } from "./storefront-tracking.tsx";
import { quotePublicShipping } from "../../lib/server/storefront-shipping.functions.ts";
type WhatsappResult=Awaited<ReturnType<typeof createWhatsappOrder>>;type PixResult=Awaited<ReturnType<typeof createOnlinePixOrder>>;
type RefreshResult=Awaited<ReturnType<typeof refreshPublicCart>>;
type CheckoutSettings=Pick<CatalogAdvancedSettings,"checkoutAskName"|"checkoutAskPhone"|"checkoutAskNotes"|"minimumOrderCents">;
const MAX_CART_QUANTITY = 999;const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function cartKey(productId:string,variantId:string|null):string{return `${productId}:${variantId??"base"}`;}
function refreshInput(cart:CartState){return cart.items.map(({productId,variantId,quantity})=>({productId,variantId,quantity}));}
function reconcileCart(cart:CartState,result:RefreshResult):{cart:CartState;changed:boolean;notice:string}{
 const previous=new Map(cart.items.map(item=>[cartKey(item.productId,item.variantId),item]));let removed=result.items.length!==cart.items.length,quantityChanged=false,priceChanged=false,descriptionChanged=false;
 for(const item of result.items){const before=previous.get(cartKey(item.productId,item.variantId));if(!before){removed=true;continue;}if(before.quantity!==item.quantity)quantityChanged=true;if(before.unitPriceCents!==item.unitPriceCents)priceChanged=true;if(before.name!==item.name||before.variantName!==item.variantName)descriptionChanged=true;}
 const changed=removed||quantityChanged||priceChanged||descriptionChanged;const notice=removed?"Um produto ou variante indisponível foi removido do carrinho.":quantityChanged?"A quantidade foi ajustada ao estoque/configuração atual.":priceChanged?"Um preço mudou e o carrinho foi atualizado. Revise antes de confirmar.":descriptionChanged?"Um item do carrinho foi atualizado. Revise antes de confirmar.":"";
 return{cart:{...cart,items:result.items},changed,notice};
}
function trackingItems(cart:CartState){return cart.items.map(item=>({id:item.productId,name:item.name,variantName:item.variantName,quantity:item.quantity,unitPriceCents:item.unitPriceCents}));}
function CartRows(props:Readonly<{cart:CartState;showPrice:boolean;quantityEnabled:boolean;onChange:(cart:CartState)=>void}>):React.JSX.Element{
 function change(productId:string,variantId:string|null,next:number):void{if (next > MAX_CART_QUANTITY) return;props.onChange(next<1?removeCartItem(props.cart,productId,variantId):setCartItemQuantity(props.cart,productId,variantId,next));}
 if(!props.cart.items.length)return <div className="sf__empty sf__empty--cart"><strong>Seu carrinho está vazio</strong><span>Escolha um produto para iniciar seu pedido.</span></div>;
 return <div className="sf__cart-list">{props.cart.items.map(item=><article className="sf__cart-row" key={cartKey(item.productId,item.variantId)}><div className="sf__cart-copy"><strong>{item.name}</strong>{item.variantName?<span className="sf__meta">{item.variantName}</span>:null}{props.showPrice?<span className="sf__meta">{storefrontMoney(item.unitPriceCents)} cada</span>:null}<button className="sf__text-button" type="button" onClick={()=>{props.onChange(removeCartItem(props.cart,item.productId,item.variantId));}}>Remover</button></div><div className="sf__cart-side">{props.showPrice?<strong>{storefrontMoney(item.unitPriceCents*item.quantity)}</strong>:null}{props.quantityEnabled?<div className="sf__qty"><button type="button" onClick={()=>{change(item.productId,item.variantId,item.quantity-1);}} aria-label="Diminuir quantidade">−</button><span>{item.quantity}</span><button type="button" disabled={item.quantity >= MAX_CART_QUANTITY} onClick={()=>{change(item.productId,item.variantId,item.quantity+1);}} aria-label="Aumentar quantidade">+</button></div>:<span className="sf__meta">Qtd. {item.quantity}</span>}</div></article>)}</div>;
}
function CheckoutFields(props:Readonly<{settings:CheckoutSettings;onlineEnabled:boolean;name:string;phone:string;email:string;coupon:string;notes:string;onName:(v:string)=>void;onPhone:(v:string)=>void;onEmail:(v:string)=>void;onCoupon:(v:string)=>void;onNotes:(v:string)=>void}>):React.JSX.Element{
 const asks=props.settings.checkoutAskName||props.settings.checkoutAskPhone||props.settings.checkoutAskNotes||props.onlineEnabled;
 return <div className="sf__checkout-fields">{asks?<div className="sf__checkout-section-head"><span>Seus dados</span><small>Usados somente no pedido e pagamento.</small></div>:null}
 {props.settings.checkoutAskName?<label className="sf__field"><span>Nome</span><input value={props.name} onChange={e=>{props.onName(e.target.value);}} autoComplete="name"/></label>:null}
 {props.settings.checkoutAskPhone?<label className="sf__field"><span>Telefone</span><input value={props.phone} onChange={e=>{props.onPhone(e.target.value);}} inputMode="tel" autoComplete="tel"/></label>:null}
 {props.onlineEnabled?<label className="sf__field"><span>E-mail para o Pix</span><input type="email" required value={props.email} onChange={e=>{props.onEmail(e.target.value);}} autoComplete="email" placeholder="voce@exemplo.com"/></label>:null}
 <label className="sf__field sf__coupon"><span>Cupom <small>opcional</small></span><input value={props.coupon} onChange={e=>{props.onCoupon(e.target.value.toUpperCase());}} autoCapitalize="characters"/></label>
 {props.settings.checkoutAskNotes?<label className="sf__field"><span>Observação <small>opcional</small></span><textarea value={props.notes} maxLength={1000} onChange={e=>{props.onNotes(e.target.value);}}/></label>:null}</div>;
}
function WhatsappSuccess({result,showPrice}:Readonly<{result:WhatsappResult;showPrice:boolean}>):React.JSX.Element{return <div className="sf__success"><h3>{result.displayNumber}</h3><p>Pedido registrado. Continue o atendimento pelo WhatsApp.</p>{showPrice?<strong>{storefrontMoney(result.totalCents)}</strong>:null}<a className="sf__primary" href={result.whatsappUrl}>Continuar no WhatsApp</a></div>;}
function PixSuccess({result,idempotencyKey}:Readonly<{result:PixResult;idempotencyKey:string}>):React.JSX.Element{
 const [copied,setCopied]=useState(false),[paymentStatus,setPaymentStatus]=useState(result.paymentStatus),[expired,setExpired]=useState(false);
 async function copy():Promise<void>{if(!result.pix.qrCode)return;await navigator.clipboard.writeText(result.pix.qrCode);setCopied(true);}
 useEffect(()=>{let active=true;async function poll():Promise<void>{try{const status=await getOnlinePixOrderStatus({data:{orderId:result.orderId,idempotencyKey}});if(!active)return;setPaymentStatus(status.paymentStatus);if(status.expiresAt&&Date.parse(status.expiresAt)<=Date.now()&&status.paymentStatus==="pending")setExpired(true);}catch{if(active)setExpired(false);}}
 void poll();const timer=window.setInterval(()=>{void poll();},5000);return()=>{active=false;window.clearInterval(timer);};},[idempotencyKey,result.orderId]);
 const paid=paymentStatus==="paid";
 return <div className="sf__success"><div className="sf__confirmation-head"><span className="sf__success-mark" aria-hidden="true">{paid?"✓":"⌁"}</span><div><span className="sf__eyebrow">{paid?"Pagamento confirmado":"Aguardando pagamento"}</span><h3>{result.displayNumber}</h3><p>{paid?"Pagamento confirmado. Seu pedido já entrou em processamento.":expired?"Este Pix expirou. Feche esta confirmação e faça um novo pedido para gerar outro código.":"Pague via Pix. Esta tela verifica a confirmação automaticamente."}</p></div></div>
 <div className="sf__summary"><div className="sf__summary-row sf__summary-row--total"><span>Total</span><strong>{storefrontMoney(result.totalCents)}</strong></div></div>
 {result.pix.qrCodeBase64?<img src={`data:image/png;base64,${result.pix.qrCodeBase64}`} alt="QR Code Pix" style={{maxWidth:240,width:"100%",margin:"0 auto"}}/>:null}
 {result.pix.qrCode?<><label className="sf__field"><span>Pix Copia e Cola</span><textarea readOnly value={result.pix.qrCode}/></label><button className="sf__primary" type="button" onClick={()=>{void copy();}}>{copied?"Código copiado":"Copiar código Pix"}</button></>:null}
 {result.pix.ticketUrl?<a className="sf__text-button" href={result.pix.ticketUrl} target="_blank" rel="noreferrer">Abrir pagamento no Mercado Pago</a>:null}</div>;
}
function safeCheckoutMessage(error:unknown):string{const message=error instanceof Error?error.message:"";if(message.toLowerCase().includes("pedido mínimo"))return"O subtotal atual ainda não atingiu o pedido mínimo desta loja.";if(message.toLowerCase().includes("cupom"))return"Confira o código, a validade, o subtotal mínimo e o limite de uso do cupom.";if(message.toLowerCase().includes("mercado pago"))return"Pagamento online temporariamente indisponível. Tente novamente em instantes.";if(message.toLowerCase().includes("carrinho")||message.toLowerCase().includes("estoque"))return"Um item mudou de disponibilidade. Revise o carrinho e tente novamente.";return message||"Não foi possível finalizar o pedido.";}
// eslint-disable-next-line max-lines-per-function
export function CartPanel(props:Readonly<{cart:CartState;whatsappEnabled:boolean;onlineEnabled:boolean;showPrice?:boolean;quantityEnabled?:boolean;checkoutSettings:CheckoutSettings;onChange:(cart:CartState)=>void;onClose:()=>void}>):React.JSX.Element{
 const key=useRef<string|null>(null),initialCart=useRef(props.cart),initialOnChange=useRef(props.onChange),dialogRef=useRef<HTMLElement|null>(null),onCloseRef=useRef(props.onClose);onCloseRef.current=props.onClose;
 const[name,setName]=useState(""),[phone,setPhone]=useState(""),[email,setEmail]=useState(""),[coupon,setCoupon]=useState(""),[notes,setNotes]=useState("");
 const[postalCode,setPostalCode]=useState(""),[shipping,setShipping]=useState<any>(null),[quotes,setQuotes]=useState<any[]>([]);const[recipientDocument,setRecipientDocument]=useState(""),[address,setAddress]=useState(""),[number,setNumber]=useState(""),[complement,setComplement]=useState(""),[district,setDistrict]=useState(""),[city,setCity]=useState(""),[stateAbbr,setStateAbbr]=useState("");
 const[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[message,setMessage]=useState(""),[whatsappSuccess,setWhatsappSuccess]=useState<WhatsappResult|null>(null),[pixSuccess,setPixSuccess]=useState<PixResult|null>(null),[minimumOrderCents,setMinimumOrderCents]=useState(props.checkoutSettings.minimumOrderCents);
 const showPrice=props.showPrice??true,quantityEnabled=props.quantityEnabled??true,subtotal=cartTotalCents(props.cart),minimumMet=subtotal>=minimumOrderCents,success=whatsappSuccess||pixSuccess;
 useEffect(()=>{const previousOverflow=document.body.style.overflow,previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=dialogRef.current;const closeButton=dialog?.querySelector<HTMLElement>(".sf__close");if(closeButton)closeButton.focus();function onKeyDown(event:KeyboardEvent):void{if(event.key === "Escape"){event.preventDefault();onCloseRef.current();return;}if(event.key !== "Tab"||!dialog)return;const items=[...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];if(!items.length)return;const first=items[0],last=items.at(-1);if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}document.body.style.overflow = "hidden";window.addEventListener("keydown",onKeyDown);return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener("keydown",onKeyDown);if(previousFocus instanceof HTMLElement)previousFocus.focus();};},[]);
 useEffect(()=>{let active=true;const cart=initialCart.current;if(!cart.items.length)return()=>{active=false;};setRefreshing(true);void refreshPublicCart({data:{items:refreshInput(cart)}}).then(result=>{if(!active)return;setMinimumOrderCents(result.minimumOrderCents);const reconciled=reconcileCart(cart,result);if(reconciled.changed){initialOnChange.current(reconciled.cart);setMessage(reconciled.notice);}}).catch((error:unknown)=>{if(active)setMessage(safeCheckoutMessage(error));}).finally(()=>{if(active)setRefreshing(false);});return()=>{active=false;};},[]);
 async function checkout(kind: "whatsapp" | "pix"): Promise<void> {
  setBusy(true);
  setMessage("");
  try {
   const refreshed = await refreshPublicCart({ data: { items: refreshInput(props.cart) } });
   setMinimumOrderCents(refreshed.minimumOrderCents);
   const reconciled = reconcileCart(props.cart, refreshed);
   if (reconciled.changed) {
    props.onChange(reconciled.cart);
    setMessage(reconciled.notice);
    return;
   }
   if (refreshed.subtotalCents < refreshed.minimumOrderCents) {
    setMessage("O subtotal atual ainda não atingiu o pedido mínimo desta loja.");
    return;
   }
   if (kind === "pix" && shipping && (!name.trim()||!phone.trim()||!email.trim()||(recipientDocument.replace(/\D/g,"").length!==11&&recipientDocument.replace(/\D/g,"").length!==14)||!address.trim()||!number.trim()||!district.trim()||!city.trim()||stateAbbr.trim().length!==2)) { setMessage("Preencha os dados completos de entrega antes de pagar."); return; }
   if (kind === "pix" && !email.trim().includes("@")) {
    setMessage("Informe um e-mail válido para gerar o Pix.");
    return;
   }
   trackStorefrontEvent({ type: "begin_checkout", items: trackingItems(reconciled.cart) });
   if (!key.current) key.current = crypto.randomUUID();
   const common = {
    idempotencyKey: key.current,
    customerName: props.checkoutSettings.checkoutAskName ? name.trim() || null : null,
    customerPhone: props.checkoutSettings.checkoutAskPhone ? phone.trim() || null : null,
    couponCode: coupon.trim() || null,
    notes: props.checkoutSettings.checkoutAskNotes ? notes.trim() || null : null,
    items: refreshInput(reconciled.cart),
   };
   if (kind === "pix") {
    const result = await createOnlinePixOrder({ data: { ...common, payerEmail: email.trim(), shipping: shipping ? {...shipping,recipient:{postalCode,name:name.trim(),phone:phone.trim(),email:email.trim(),document:recipientDocument,address:address.trim(),number:number.trim(),complement:complement.trim()||null,district:district.trim(),city:city.trim(),stateAbbr:stateAbbr.trim().toUpperCase()}} : null } });
    setPixSuccess(result);
    props.onChange(clearCart(reconciled.cart));
    trackStorefrontEvent({ type: "order_created", orderId: result.orderId, totalCents: result.totalCents, items: trackingItems(reconciled.cart) });
   } else {
    const result = await createWhatsappOrder({ data: common });
    setWhatsappSuccess(result);
    props.onChange(clearCart(reconciled.cart));
    trackStorefrontEvent({ type: "order_created", orderId: result.orderId, totalCents: result.totalCents, items: trackingItems(reconciled.cart) });
   }
  } catch (error) {
   setMessage(safeCheckoutMessage(error));
  } finally {
   setBusy(false);
  }
 }
 let body: React.JSX.Element;
 if(pixSuccess) body=<PixSuccess result={pixSuccess} idempotencyKey={key.current ?? ""}/>;
 else if(whatsappSuccess) body=<WhatsappSuccess result={whatsappSuccess} showPrice={showPrice}/>;
 else body=<><CartRows cart={props.cart} showPrice={showPrice} quantityEnabled={quantityEnabled} onChange={props.onChange}/>{props.cart.items.length?<div className="sf__checkout">
  {props.onlineEnabled?<div className="sf__checkout-fields"><div className="sf__checkout-section-head"><span>Entrega</span><small>Calcule o frete pelo CEP.</small></div><label className="sf__field"><span>CEP</span><input value={postalCode} inputMode="numeric" onChange={e=>setPostalCode(e.target.value)} /></label><button type="button" className="sf__text-button" onClick={()=>{void quotePublicShipping({data:{items:refreshInput(props.cart),destinationPostalCode:postalCode}}).then(value=>{setQuotes(value);}).catch(e=>setMessage(safeCheckoutMessage(e)));}}>Calcular frete</button>{quotes.map(q=><button key={q.serviceId} type="button" className="sf__text-button" data-selected={shipping?.serviceId===q.serviceId} onClick={()=>setShipping(q)}>{q.companyName} · {q.serviceName} · {storefrontMoney(q.priceCents)} · até {q.deliveryDays} dias</button>)}{shipping?<div className="sf__checkout-fields"><div className="sf__checkout-section-head"><span>Endereço de entrega</span><small>Necessário para gerar a etiqueta.</small></div><label className="sf__field"><span>CPF/CNPJ</span><input value={recipientDocument} onChange={e=>setRecipientDocument(e.target.value)} inputMode="numeric"/></label><label className="sf__field"><span>Endereço</span><input value={address} onChange={e=>setAddress(e.target.value)} autoComplete="street-address"/></label><label className="sf__field"><span>Número</span><input value={number} onChange={e=>setNumber(e.target.value)}/></label><label className="sf__field"><span>Complemento</span><input value={complement} onChange={e=>setComplement(e.target.value)}/></label><label className="sf__field"><span>Bairro</span><input value={district} onChange={e=>setDistrict(e.target.value)}/></label><label className="sf__field"><span>Cidade</span><input value={city} onChange={e=>setCity(e.target.value)}/></label><label className="sf__field"><span>UF</span><input value={stateAbbr} maxLength={2} onChange={e=>setStateAbbr(e.target.value.toUpperCase())}/></label></div>:null}</div>:null}<CheckoutFields settings={props.checkoutSettings} onlineEnabled={props.onlineEnabled} name={name} phone={phone} email={email} coupon={coupon} notes={notes} onName={setName} onPhone={setPhone} onEmail={setEmail} onCoupon={setCoupon} onNotes={setNotes}/>
  <div className="sf__summary">{showPrice?<div className="sf__summary-row sf__summary-row--total"><span>Subtotal</span><strong>{storefrontMoney(subtotal)}</strong></div>:null}{minimumOrderCents>0?<p className="sf__minimum-order" data-met={minimumMet}>Pedido mínimo: {storefrontMoney(minimumOrderCents)}{minimumMet?" · atingido":""}</p>:null}</div>
  {message?<div className="sf__checkout-error" role="alert">{message}</div>:null}
  <div className="sf__checkout-actions"><button className="sf__text-button" type="button" onClick={()=>{props.onChange(clearCart(props.cart));}}>Limpar carrinho</button>
   {props.whatsappEnabled?<button className="sf__primary" disabled={busy||refreshing||!minimumMet} type="button" onClick={()=>{void checkout("whatsapp");}}>Finalizar por WhatsApp</button>:null}
   {props.onlineEnabled?<button className="sf__primary" disabled={busy||refreshing||!minimumMet} type="button" onClick={()=>{void checkout("pix");}}>{busy||refreshing?"Gerando Pix…":"Pagar com Pix"}</button>:null}
   {!props.whatsappEnabled&&!props.onlineEnabled?<div className="sf__checkout-error">Nenhum método de checkout público está disponível nesta loja.</div>:null}
  </div></div>:null}</>;
 return <div className="sf__overlay sf__overlay--drawer" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)props.onClose();}}>
  <section ref={dialogRef} className="sf__modal sf__cart-modal" aria-modal="true" role="dialog" aria-label={success?"Confirmação do pedido":"Carrinho e checkout"}>
   <div className="sf__modal-head"><div><span className="sf__eyebrow">{success?"Confirmação":"Seu pedido"}</span><h2>{success?"Pedido confirmado":"Carrinho"}</h2></div><button className="sf__close" type="button" onClick={props.onClose} aria-label="Fechar">×</button></div>
   {body}
  </section>
 </div>;
}
