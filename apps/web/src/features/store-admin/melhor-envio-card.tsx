import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { connectMelhorEnvio } from "../../lib/server/melhor-envio.functions.ts";

export function MelhorEnvioCard(props:Readonly<{connected:boolean;enabled:boolean;postalCode:string|null}>):React.JSX.Element{
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const router=useRouter();
 async function connect():Promise<void>{setBusy(true);setMessage("");try{const r=await connectMelhorEnvio();window.location.assign(r.authorizationUrl);}catch{setMessage("Não foi possível iniciar a conexão com o Melhor Envio.");setBusy(false);}}
 return <div className="k-card"><div className="k-card__header"><div><h3>Melhor Envio</h3><p>Cotações, etiquetas e rastreamento da entrega.</p></div><span className={props.connected?"k-status k-success":"k-status"}>{props.connected?"Conectado":"Não conectado"}</span></div>
 <p className="k-muted">{props.enabled&&props.postalCode?`Origem de frete: ${props.postalCode}`:"Complete o perfil de expedição para liberar cotações no checkout."}</p>
 {message?<p className="k-status k-danger">{message}</p>:null}<div className="k-actions"><button className="k-button k-button--primary" disabled={busy} type="button" onClick={()=>{void connect();}}>{busy?"Abrindo…":props.connected?"Reconectar Melhor Envio":"Conectar Melhor Envio"}</button><button className="k-button" type="button" onClick={()=>{void router.invalidate();}}>Atualizar status</button></div></div>;
}
