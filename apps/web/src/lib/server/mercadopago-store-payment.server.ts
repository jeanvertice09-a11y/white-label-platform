import { createCredentialVaultFromEnv, createPaymentProvider } from "@white-label/payments/server";
import type { GatewayAccountId, PaymentCheckoutData } from "@white-label/payments";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
const MP_TOKEN_URL="https://api.mercadopago.com/oauth/token";
type Scope={tenantId:string;storeId:string}; type Gateway={id:string;accessCipher:string;refreshCipher:string;expiresAt:string|null};
function requiredEnv(name:"MERCADOPAGO_CLIENT_ID"|"MERCADOPAGO_CLIENT_SECRET"):string{const value=process.env[name]?.trim();if(!value)throw new Error(`Configuração obrigatória ausente: ${name}`);return value;}
async function gateway(scope:Scope):Promise<Gateway>{
 const rows=await createAdminSqlExecutor().query(`select ga.id::text,s.credentials_ciphertext,s.oauth_refresh_token_ciphertext,s.oauth_access_token_expires_at::text
 from public.gateway_accounts ga join private.gateway_account_secrets s on s.gateway_account_id=ga.id
 where ga.level='store_checkout' and ga.provider='mercadopago' and ga.status='active' and ga.tenant_id=$1::uuid and ga.store_id=$2::uuid limit 1`,[scope.tenantId,scope.storeId]);
 const row=rows.at(0);if(!row)throw new Error("Mercado Pago não está conectado nesta loja.");const accessCipher=row["credentials_ciphertext"],refreshCipher=row["oauth_refresh_token_ciphertext"];
 if(typeof accessCipher!=="string"||typeof refreshCipher!=="string")throw new Error("Conexão Mercado Pago incompleta.");
 return{id:String(row["id"]),accessCipher,refreshCipher,expiresAt:typeof row["oauth_access_token_expires_at"]==="string"?row["oauth_access_token_expires_at"]:null};
}
async function accessToken(account:Gateway):Promise<string>{
 const vault=createCredentialVaultFromEnv(),expires=account.expiresAt?Date.parse(account.expiresAt):0;if(expires>Date.now()+300000)return vault.decrypt(account.accessCipher);
 const response=await fetch(MP_TOKEN_URL,{method:"POST",headers:{accept:"application/json","content-type":"application/json"},body:JSON.stringify({
  client_id:requiredEnv("MERCADOPAGO_CLIENT_ID"),client_secret:requiredEnv("MERCADOPAGO_CLIENT_SECRET"),grant_type:"refresh_token",refresh_token:vault.decrypt(account.refreshCipher)})});
 const body=await response.json() as Record<string,unknown>,token=body["access_token"],refresh=body["refresh_token"],expiresIn=body["expires_in"];
 if(!response.ok||typeof token!=="string"||typeof refresh!=="string"||typeof expiresIn!=="number")throw new Error("Não foi possível renovar a autorização do Mercado Pago.");
 await createAdminSqlExecutor().query(`update private.gateway_account_secrets set credentials_ciphertext=$2,oauth_refresh_token_ciphertext=$3,
 oauth_access_token_expires_at=now()+($4::int*interval '1 second'),updated_at=now() where gateway_account_id=$1::uuid`,
 [account.id,vault.encrypt(token),vault.encrypt(refresh),Math.max(60,Math.trunc(expiresIn))]);return token;
}
export async function ensureMercadoPagoGatewayAccessToken(gatewayAccountId:string):Promise<void>{
 const rows=await createAdminSqlExecutor().query(`select ga.id::text,s.credentials_ciphertext,s.oauth_refresh_token_ciphertext,s.oauth_access_token_expires_at::text
 from public.gateway_accounts ga join private.gateway_account_secrets s on s.gateway_account_id=ga.id
 where ga.id=$1::uuid and ga.level='store_checkout' and ga.provider='mercadopago' and ga.status='active' limit 1`,[gatewayAccountId]);
 const row=rows.at(0);if(!row)return;const accessCipher=row["credentials_ciphertext"],refreshCipher=row["oauth_refresh_token_ciphertext"];
 if(typeof accessCipher!=="string"||typeof refreshCipher!=="string")throw new Error("Conexão Mercado Pago incompleta.");
 await accessToken({id:gatewayAccountId,accessCipher,refreshCipher,expiresAt:typeof row["oauth_access_token_expires_at"]==="string"?row["oauth_access_token_expires_at"]:null});
}
export async function createStorePixPayment(scope:Scope,input:{orderId:string;orderNumber:number;amountCents:number;payerEmail:string}):Promise<{paymentId:string;checkout:PaymentCheckoutData}>{
 const sql=createAdminSqlExecutor();const existing=await sql.query(`select id::text,checkout_qr_code,checkout_qr_code_base64,checkout_ticket_url,checkout_expires_at::text
 from public.payments where level='store_checkout' and tenant_id=$1::uuid and store_id=$2::uuid and order_id=$3::uuid limit 1`,[scope.tenantId,scope.storeId,input.orderId]);
 const old=existing.at(0);if(old)return{paymentId:String(old["id"]),checkout:{qrCode:typeof old["checkout_qr_code"]==="string"?old["checkout_qr_code"]:null,
 qrCodeBase64:typeof old["checkout_qr_code_base64"]==="string"?old["checkout_qr_code_base64"]:null,ticketUrl:typeof old["checkout_ticket_url"]==="string"?old["checkout_ticket_url"]:null,
 expiresAt:typeof old["checkout_expires_at"]==="string"?old["checkout_expires_at"]:null}};
 const account=await gateway(scope),token=await accessToken(account),provider=createPaymentProvider("mercadopago",{credentials:token,webhookSecret:null},{writesEnabled:true});
 const created=await provider.createIntent({level:"store_checkout",tenantId:scope.tenantId,storeId:scope.storeId,gatewayAccountId:account.id as GatewayAccountId,
 amountCents:input.amountCents,idempotencyKey:`order-${input.orderId}`,description:`Pedido #${String(input.orderNumber)}`,externalReference:input.orderId,payerEmail:input.payerEmail,paymentMethod:"pix"});
 const checkout=created.checkout??{qrCode:null,qrCodeBase64:null,ticketUrl:null,expiresAt:null};
 const rows=await sql.query(`insert into public.payments(level,tenant_id,store_id,gateway_account_id,provider_payment_id,amount_cents,currency,status,order_id,
 checkout_qr_code,checkout_qr_code_base64,checkout_ticket_url,checkout_expires_at)
 values ('store_checkout',$1::uuid,$2::uuid,$3::uuid,$4,$5,'BRL','pending',$6::uuid,$7,$8,$9,$10::timestamptz)
 on conflict (tenant_id,store_id,order_id) where level='store_checkout' and order_id is not null do update
 set provider_payment_id=coalesce(public.payments.provider_payment_id,excluded.provider_payment_id),checkout_qr_code=coalesce(public.payments.checkout_qr_code,excluded.checkout_qr_code),
 checkout_qr_code_base64=coalesce(public.payments.checkout_qr_code_base64,excluded.checkout_qr_code_base64),checkout_ticket_url=coalesce(public.payments.checkout_ticket_url,excluded.checkout_ticket_url),
 checkout_expires_at=coalesce(public.payments.checkout_expires_at,excluded.checkout_expires_at),updated_at=now() returning id::text`,
 [scope.tenantId,scope.storeId,account.id,created.providerPaymentId,input.amountCents,input.orderId,checkout.qrCode,checkout.qrCodeBase64,checkout.ticketUrl,checkout.expiresAt]);
 const paymentId=rows.at(0)?.["id"];if(typeof paymentId!=="string")throw new Error("Não foi possível persistir o pagamento Pix.");return{paymentId,checkout};
}
