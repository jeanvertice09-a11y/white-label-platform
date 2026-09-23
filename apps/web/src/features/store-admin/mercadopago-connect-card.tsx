import { useState } from "react";
import { startMerchantMercadoPagoOAuth } from "../../lib/server/mercadopago-oauth.functions.ts";

export function MercadoPagoConnectCard(props:{
 connected:boolean;
 mercadoPagoUserId:string|null;
 updatedAt:string|null;
 available:boolean;
}):React.JSX.Element{
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 async function connect(){
  if(!props.available)return;
  setBusy(true);setError(null);
  try{const result=await startMerchantMercadoPagoOAuth();window.location.assign(result.authorizationUrl);}
  catch{setError("Não foi possível iniciar a conexão com o Mercado Pago.");setBusy(false);}
 }
 return <div className="k-card">
  <h3>Mercado Pago</h3>
  <p>{props.connected?"Conectado para receber pagamentos do catálogo público.":"Conecte sua conta Mercado Pago com autorização segura. Nenhum Access Token é digitado ou exposto no navegador."}</p>
  {props.connected&&props.mercadoPagoUserId?<p className="k-muted">Conta Mercado Pago: {props.mercadoPagoUserId}</p>:null}
  {!props.available&&!props.connected?<p className="k-inline-state">Integração temporariamente indisponível neste ambiente. A configuração será liberada quando o gateway estiver pronto.</p>:null}
  <button className="k-button k-button-primary" type="button" disabled={busy||!props.available} onClick={()=>{void connect();}}>
   {busy?"Abrindo Mercado Pago…":props.connected?"Reconectar Mercado Pago":"Conectar Mercado Pago"}
  </button>
  {error?<p className="k-inline-state" role="alert">{error}</p>:null}
 </div>;
}
