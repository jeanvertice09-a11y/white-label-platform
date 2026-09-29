import { useState } from "react";
import { disconnectMerchantMercadoPago } from "../../lib/server/mercadopago-disconnect.functions.ts";
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
 async function disconnect(){
  if(!window.confirm("Desconectar o Mercado Pago desta loja? O checkout deixará de gerar novos pagamentos até uma nova conexão."))return;
  setBusy(true);setError(null);
  try{await disconnectMerchantMercadoPago();window.location.reload();}
  catch{setError("Não foi possível desconectar o Mercado Pago.");setBusy(false);}
 }
 return <div className="k-card">
  <h3>Mercado Pago</h3>
  <p>{props.connected?"Conectado para receber pagamentos do catálogo público. A autorização e a renovação dos tokens são automáticas.":"Conecte sua conta Mercado Pago com autorização segura. Nenhum Access Token, Client ID ou segredo é digitado no navegador."}</p>
  {props.connected&&props.mercadoPagoUserId?<p className="k-muted">Conta Mercado Pago: {props.mercadoPagoUserId}</p>:null}
  {!props.available&&!props.connected?<p className="k-inline-state">Integração temporariamente indisponível neste ambiente.</p>:null}
  <div className="k-actions">
   <button className="k-button k-button-primary" type="button" disabled={busy||!props.available} onClick={()=>{void connect();}}>
    {busy?"Aguarde…":props.connected?"Reconectar Mercado Pago":"Conectar Mercado Pago"}
   </button>
   {props.connected?<button className="k-button" type="button" disabled={busy} onClick={()=>{void disconnect();}}>Desconectar</button>:null}
  </div>
  {error?<p className="k-inline-state" role="alert">{error}</p>:null}
 </div>;
}
