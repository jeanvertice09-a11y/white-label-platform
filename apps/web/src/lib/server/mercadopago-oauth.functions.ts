import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createCredentialVaultFromEnv } from "@white-label/payments/server";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { resolveSessionFromRequest } from "./session.server.ts";
import { requireMfaAssurance } from "./route-context.server.ts";

const MP_AUTH_URL="https://auth.mercadopago.com/authorization";
const MP_TOKEN_URL="https://api.mercadopago.com/oauth/token";
const callbackSchema=z.object({code:z.string().trim().min(8).max(4096),state:z.string().trim().min(32).max(512)});
type OAuthState={tenantId:string;storeId:string;verifierCiphertext:string;returnUrl:string};
type TokenSet={accessToken:string;refreshToken:string;userId:string;expiresIn:number};

function requiredEnv(name:"MERCADOPAGO_CLIENT_ID"|"MERCADOPAGO_CLIENT_SECRET"|"MERCADOPAGO_OAUTH_REDIRECT_URI"|"MERCADOPAGO_WEBHOOK_SECRET"):string{
 const value=process.env[name]?.trim(); if(!value) throw new Error(`Configuração obrigatória ausente: ${name}`); return value;
}
function sha256(value:string):string{return createHash("sha256").update(value).digest("hex");}
function challenge(verifier:string):string{return createHash("sha256").update(verifier).digest("base64url");}
function safeReturnUrl(host:string):string{
 const clean=host.toLowerCase().split(":")[0]?.replace(/\.$/u,""); if(!clean) throw new Error("Host administrativo inválido.");
 return `https://${clean}/admin/settings`;
}
function parseTokenSet(body:Record<string,unknown>):TokenSet{
 const accessToken=typeof body["access_token"]==="string"?body["access_token"]:"";
 const refreshToken=typeof body["refresh_token"]==="string"?body["refresh_token"]:"";
 const rawUserId=body["user_id"]; const userId=typeof rawUserId==="number"||typeof rawUserId==="string"?String(rawUserId):"";
 const expiresIn=typeof body["expires_in"]==="number"?Math.max(60,Math.trunc(body["expires_in"])):15_552_000;
 if(!accessToken||!refreshToken||!userId) throw new Error("Resposta OAuth do Mercado Pago incompleta.");
 return {accessToken,refreshToken,userId,expiresIn};
}
async function claimState(state:string,userId:string):Promise<OAuthState>{
 const rows=await createAdminSqlExecutor().query(
  `update private.mercadopago_oauth_states set consumed_at=now()
   where state_hash=$1 and consumed_at is null and expires_at>now() and actor_user_id=$2::uuid
     and exists (select 1 from public.tenant_members tm where tm.tenant_id=mercadopago_oauth_states.tenant_id and tm.user_id=$2::uuid)
     and exists (select 1 from public.store_members sm where sm.tenant_id=mercadopago_oauth_states.tenant_id and sm.store_id=mercadopago_oauth_states.store_id and sm.user_id=$2::uuid)
   returning tenant_id::text,store_id::text,code_verifier_ciphertext,return_url`,[sha256(state),userId]);
 const row=rows.at(0); if(!row) throw new Error("Autorização Mercado Pago inválida, expirada ou já utilizada.");
 if(typeof row["code_verifier_ciphertext"]!=="string"||typeof row["return_url"]!=="string") throw new Error("Estado OAuth inválido.");
 return {tenantId:String(row["tenant_id"]),storeId:String(row["store_id"]),verifierCiphertext:row["code_verifier_ciphertext"],returnUrl:row["return_url"]};
}
async function exchangeCode(code:string,verifierCiphertext:string):Promise<TokenSet>{
 const vault=createCredentialVaultFromEnv();
 const response=await fetch(MP_TOKEN_URL,{method:"POST",headers:{accept:"application/json","content-type":"application/json"},body:JSON.stringify({
  client_id:requiredEnv("MERCADOPAGO_CLIENT_ID"),client_secret:requiredEnv("MERCADOPAGO_CLIENT_SECRET"),code,
  grant_type: "authorization_code",redirect_uri:requiredEnv("MERCADOPAGO_OAUTH_REDIRECT_URI"),code_verifier:vault.decrypt(verifierCiphertext),
 })});
 const body=await response.json() as Record<string,unknown>;
 if(!response.ok) throw new Error("Mercado Pago recusou a autorização. Tente conectar novamente.");
 return parseTokenSet(body);
}
async function saveConnection(state:OAuthState,tokens:TokenSet,actorUserId:string):Promise<void>{
 const vault=createCredentialVaultFromEnv(); const { accessToken, refreshToken } = tokens; const rows=await createAdminSqlExecutor().query(
 `with account as (
    insert into public.gateway_accounts(level,tenant_id,store_id,provider,label,public_identifier,status,updated_at)
    values ('store_checkout',$1::uuid,$2::uuid,'mercadopago','Mercado Pago',$3,'active',now())
    on conflict (tenant_id,store_id,provider,level) where level='store_checkout' do update set public_identifier=excluded.public_identifier,status='active',updated_at=now()
    returning id
  ), secret as (
    insert into private.gateway_account_secrets(gateway_account_id,credentials_ciphertext,webhook_secret_ciphertext,oauth_refresh_token_ciphertext,oauth_access_token_expires_at)
    select id,$4,$5,$6,now()+($7::int*interval '1 second') from account
    on conflict (gateway_account_id) do update set credentials_ciphertext=excluded.credentials_ciphertext,
      webhook_secret_ciphertext=excluded.webhook_secret_ciphertext,oauth_refresh_token_ciphertext=excluded.oauth_refresh_token_ciphertext,
      oauth_access_token_expires_at=excluded.oauth_access_token_expires_at,updated_at=now()
  ), audited as (
    insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
    select $8::uuid,$1::uuid,$2::uuid,'gateway_account.oauth_connected','gateway_account',id::text,jsonb_build_object('provider','mercadopago','level','store_checkout') from account
  ) select id::text from account`,
 [state.tenantId,state.storeId,tokens.userId,vault.encrypt(accessToken),vault.encrypt(requiredEnv("MERCADOPAGO_WEBHOOK_SECRET")),vault.encrypt(refreshToken),tokens.expiresIn,actorUserId]);
 if(rows.length === 0) throw new Error("Não foi possível persistir a conexão Mercado Pago.");
}

export const getMerchantMercadoPagoConnection=createServerFn({method:"GET"}).handler(async()=>{
 const context=await createMerchantCatalogContext(getRequestHost()); const rows=await createAdminSqlExecutor().query(
  `select ga.id::text,ga.status,ga.public_identifier,ga.updated_at::text,(s.credentials_ciphertext is not null) connected
   from public.gateway_accounts ga join private.gateway_account_secrets s on s.gateway_account_id=ga.id
   where ga.level='store_checkout' and ga.provider='mercadopago' and ga.tenant_id=$1::uuid and ga.store_id=$2::uuid
   order by ga.updated_at desc limit 1`,[context.scope.tenantId,context.scope.storeId]);
 const row=rows.at(0); return row?{connected:row["connected"]===true&&row["status"]==="active",accountId:typeof row["id"]==="string"?row["id"]:null,
  mercadoPagoUserId:typeof row["public_identifier"]==="string"?row["public_identifier"]:null,updatedAt:typeof row["updated_at"]==="string"?row["updated_at"]:null}
  :{connected:false,accountId:null,mercadoPagoUserId:null,updatedAt:null};
});
export const startMerchantMercadoPagoOAuth=createServerFn({method:"POST"}).handler(async()=>{
 const host=getRequestHost(); const context=await createMerchantCatalogContext(host); requiredEnv("MERCADOPAGO_CLIENT_SECRET"); requiredEnv("MERCADOPAGO_WEBHOOK_SECRET");
 const verifier=randomBytes(64).toString("base64url").slice(0,86); const state=randomBytes(32).toString("base64url"); const vault=createCredentialVaultFromEnv();
 await createAdminSqlExecutor().query(`insert into private.mercadopago_oauth_states(state_hash,tenant_id,store_id,actor_user_id,code_verifier_ciphertext,return_url,expires_at)
  values ($1,$2::uuid,$3::uuid,$4::uuid,$5,$6,now()+interval '10 minutes')`,
  [sha256(state),context.scope.tenantId,context.scope.storeId,context.userId,vault.encrypt(verifier),safeReturnUrl(host)]);
 const url=new URL(MP_AUTH_URL); url.searchParams.set("response_type","code"); url.searchParams.set("client_id",requiredEnv("MERCADOPAGO_CLIENT_ID"));
 url.searchParams.set("redirect_uri",requiredEnv("MERCADOPAGO_OAUTH_REDIRECT_URI")); url.searchParams.set("state", state);
 url.searchParams.set("code_challenge",challenge(verifier)); url.searchParams.set("code_challenge_method", "S256"); return {authorizationUrl:url.toString()};
});
export const completeMerchantMercadoPagoOAuth=createServerFn({method:"POST"}).validator(callbackSchema).handler(async({data})=>{
 const session=await resolveSessionFromRequest(); if(!session) throw new Error("Sessão administrativa necessária para concluir a conexão."); requireMfaAssurance(session);
 const state=await claimState(data.state,session.userId); const tokens=await exchangeCode(data.code,state.verifierCiphertext);
 await saveConnection(state,tokens,session.userId); return {ok:true,returnUrl:state.returnUrl};
});
