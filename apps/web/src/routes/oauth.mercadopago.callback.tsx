import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { completeMerchantMercadoPagoOAuth } from "../lib/server/mercadopago-oauth.functions.ts";
const searchSchema=z.object({code:z.string().optional(),state:z.string().optional(),error:z.string().optional()});
// @ts-expect-error routeTree.gen.ts is regenerated during build for this new route.
export const Route=createFileRoute("/oauth/mercadopago/callback")({validateSearch:searchSchema,component:MercadoPagoCallback});
function MercadoPagoCallback():React.JSX.Element{
 const[message,setMessage]=useState("Concluindo conexão com Mercado Pago…");
 useEffect(()=>{void(async()=>{const params=new URLSearchParams(window.location.search),code=params.get("code"),state=params.get("state"),error=params.get("error");
  if(error){setMessage("A autorização no Mercado Pago foi cancelada ou recusada.");return;}
  if(!code||!state){setMessage("Retorno do Mercado Pago incompleto.");return;}
  try{const result=await completeMerchantMercadoPagoOAuth({data:{code,state}});window.location.assign(result.returnUrl);}
  catch(cause){setMessage(cause instanceof Error?cause.message:"Não foi possível concluir a conexão.");}
 })();},[]);
 return <main className="k-auth-shell"><section className="k-auth-card"><h1>Mercado Pago</h1><p>{message}</p></section></main>;
}
