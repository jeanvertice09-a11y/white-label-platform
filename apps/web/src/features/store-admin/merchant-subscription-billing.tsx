import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { createMerchantSubscriptionPayment,saveMerchantBillingProfile } from "../../lib/server/merchant-subscription-billing.functions.ts";
type Data=Record<string,unknown>|null;
const text=(v:unknown)=>typeof v==="string"?v:"";
const formText=(f:FormData,k:string)=>{const v=f.get(k);return typeof v==="string"?v:"";};
const money=(v:unknown)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v??0)/100);
export function MerchantSubscriptionBilling({data}:Readonly<{data:Data}>):React.JSX.Element{
 const router=useRouter();const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [checkout,setCheckout]=useState<{qrCode?:string|null;qrCodeBase64?:string|null;ticketUrl?:string|null}|null>(null);
 if(!data)return <div className="k-card"><p className="k-inline-state">Nenhuma assinatura comercial encontrada.</p></div>;
 async function profile(e:React.SyntheticEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);try{await saveMerchantBillingProfile({data:{legalName:formText(f,"legalName"),taxId:formText(f,"taxId"),billingEmail:formText(f,"billingEmail")}});setMessage("Dados de cobrança salvos.");await router.invalidate();}catch(x){setMessage(x instanceof Error?x.message:"Falha ao salvar.");}finally{setBusy(false)}}
 async function pay(){setBusy(true);try{const r=await createMerchantSubscriptionPayment();setCheckout(r.checkout??null);setMessage(r.status==="captured"?"Pagamento já confirmado.":"Cobrança Pix pronta para pagamento.");await router.invalidate();}catch(x){setMessage(x instanceof Error?x.message:"Falha ao criar cobrança.");}finally{setBusy(false)}}
 return <div className="k-card"><h3>{text(data["plan_name"])||"Plano"}</h3><p><strong>{money(data["price_cents"])}</strong> · {text(data["billing_interval"])} · status {text(data["status"])}</p>
 <form className="k-form" onSubmit={e=>{void profile(e)}}><div className="k-form__grid"><label>Nome / razão social<input name="legalName" required defaultValue={text(data["legal_name"])} /></label><label>CPF/CNPJ<input name="taxId" required defaultValue={text(data["tax_id"])} /></label><label>E-mail de cobrança<input type="email" name="billingEmail" required defaultValue={text(data["billing_email"])} /></label></div><button className="k-button" disabled={busy}>Salvar dados de cobrança</button></form>
 <div className="k-actions"><button className="k-button k-button--primary" type="button" disabled={busy||!data["provider"]} onClick={()=>{void pay()}}>Gerar Pix e pagar plano</button></div>
 {checkout?.qrCodeBase64?<img alt="QR Code Pix" style={{maxWidth:240}} src={`data:image/png;base64,${checkout.qrCodeBase64}`} />:null}
 {checkout?.qrCode?<><label>Pix Copia e Cola<textarea readOnly value={checkout.qrCode} /></label></>:null}
 {checkout?.ticketUrl?<a className="k-text-action" href={checkout.ticketUrl} target="_blank" rel="noreferrer">Abrir pagamento</a>:null}
 {message?<p className="k-status" role="status">{message}</p>:null}</div>;
}
