import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { completeMelhorEnvioConnection } from "../lib/server/melhor-envio.functions.ts";
const searchSchema=z.object({code:z.string().optional(),state:z.string().optional(),error:z.string().optional()});
export const Route=createFileRoute("/oauth/melhor-envio/callback")({validateSearch:searchSchema,component:MelhorEnvioCallback});
function MelhorEnvioCallback():React.JSX.Element{
 const[message,setMessage]=useState("Concluindo conexão com Melhor Envio…");
 useEffect(()=>{void(async()=>{const params=new URLSearchParams(window.location.search),code=params.get("code"),state=params.get("state"),error=params.get("error");
  if(error){setMessage("A autorização no Melhor Envio foi cancelada ou recusada.");return;}
  if(!code||!state){setMessage("Retorno do Melhor Envio incompleto.");return;}
  try{const result=await completeMelhorEnvioConnection({data:{code,state}});window.location.assign(result.returnUrl);}
  catch(cause){setMessage(cause instanceof Error?cause.message:"Não foi possível concluir a conexão.");}
 })();},[]);
 return <main className="k-auth-shell"><section className="k-auth-card"><h1>Melhor Envio</h1><p>{message}</p></section></main>;
}
