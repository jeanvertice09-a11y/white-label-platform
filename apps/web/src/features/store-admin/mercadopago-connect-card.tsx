import { useState } from "react";
import { startMerchantMercadoPagoOAuth } from "../../lib/server/mercadopago-oauth.functions.ts";
export function MercadoPagoConnectCard(props:{connected:boolean;mercadoPagoUserId:string|null;updatedAt:string|null}):React.JSX.Element{
 const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
 async function connect(){setBusy(true);setError(null);try{const result=await startMerchantMercadoPagoOAuth();window.location.assign(result.authorizationUrl);}
 catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível iniciar a conexão.");setBusy(false);}}
 return <div className="k-card"><h3>Mercado Pago</h3><p>{props.connected?"Conectado para receber pagamentos do catálogo público.":"Conecte sua conta Mercado Pago com autorização segura. Nenhum Access Token é digitado ou exposto no navegador."}</p>
 {props.connected&&props.mercadoPagoUserId?<p className="k-muted">Conta Mercado Pago: {props.mercadoPagoUserId}</p>:null}
 <button className="k-button k-button-primary" type="button" disabled={busy} onClick={()=>{void connect();}}>{busy?"Abrindo Mercado Pago…":props.connected?"Reconectar Mercado Pago":"Conectar Mercado Pago"}</button>
 {error?<p className="k-inline-state" role="alert">{error}</p>:null}</div>;
}