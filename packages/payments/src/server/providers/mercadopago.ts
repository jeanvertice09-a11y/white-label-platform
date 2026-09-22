import { createHmac } from "node:crypto";
import type { CreatePaymentIntentInput, CreatePaymentIntentResult, NormalizedProviderEvent, PaymentProvider, PaymentStatus, ProviderPaymentId, ProviderWebhookInput, RefundPaymentInput } from "../../types.ts";
import { asProviderPaymentId, centsToDecimal, normalizeCommonStatus, readJson, requireIdempotencyKey, safeEqual } from "../provider-common.ts";
import type { HttpFetch } from "../provider-common.ts";
const BASE_URL = "https://api.mercadopago.com";
interface MercadoPagoOptions { accessToken: string; webhookSecret: string | null; fetch?: HttpFetch; writesEnabled?: boolean; }
export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago" as const; private readonly http: HttpFetch;
  constructor(private readonly options: MercadoPagoOptions) { if (!options.accessToken) throw new Error("Credencial Mercado Pago ausente."); this.http = options.fetch ?? fetch; }
  async createIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    this.assertWritesEnabled();
    if ((input.paymentMethod ?? "pix") !== "pix" || !input.payerEmail) throw new Error("Mercado Pago: criação preparada somente para Pix com payerEmail.");
    const key = requireIdempotencyKey(input.idempotencyKey);
    if (input.level === "store_checkout") return this.createStorePixOrder(input, key);
    const response = await this.http(`${BASE_URL}/v1/payments`, { method: "POST", headers: this.headers(key), body: JSON.stringify({
      transaction_amount: centsToDecimal(input.amountCents), description: input.description ?? "Pagamento", payment_method_id: "pix",
      external_reference: input.externalReference, payer: { email: input.payerEmail },
    }) });
    const body = await readJson(response); return { providerPaymentId: asProviderPaymentId(body["id"]) };
  }
  private async createStorePixOrder(input: CreatePaymentIntentInput, key: string): Promise<CreatePaymentIntentResult> {
    const amount = centsToDecimal(input.amountCents).toFixed(2);
    const response = await this.http(`${BASE_URL}/v1/orders`, { method: "POST", headers: this.headers(key), body: JSON.stringify({
      type: "online", total_amount: amount, external_reference: input.externalReference, processing_mode: "automatic",
      transactions: { payments: [{ amount, payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: "P1D" }] },
      payer: { email: input.payerEmail },
    }) });
    const body = await readJson(response); const payment = firstPayment(body); const method = objectBody(payment["payment_method"]);
    return { providerPaymentId: asProviderPaymentId(body["id"]), checkout: {
      qrCode: textOrNull(method["qr_code"]), qrCodeBase64: textOrNull(method["qr_code_base64"]),
      ticketUrl: textOrNull(method["ticket_url"]), expiresAt: textOrNull(payment["expiration_time"]),
    } };
  }
  async fetchStatus(providerPaymentId: ProviderPaymentId): Promise<PaymentStatus> {
    const isOrder = providerPaymentId.startsWith("ORD");
    const response = await this.http(`${BASE_URL}/v1/${isOrder ? "orders" : "payments"}/${encodeURIComponent(providerPaymentId)}`, { headers: this.headers() });
    const body = await readJson(response);
    if (isOrder) return orderStatus(typeof body["status"] === "string" ? body["status"] : "");
    const status = normalizeCommonStatus(typeof body["status"] === "string" ? body["status"] : "");
    if (!status) throw new Error("Status Mercado Pago desconhecido."); return status;
  }
  verifyWebhook(input: ProviderWebhookInput): Promise<boolean> {
    const secret=this.options.webhookSecret,signature=input.headers["x-signature"],requestId=input.headers["x-request-id"];
    const dataId=input.query?.["data.id"] ?? input.query?.["data_id"]; if(!secret||!signature||!requestId||!dataId)return Promise.resolve(false);
    const timestamp=signatureValue(signature,"ts"),expected=signatureValue(signature,"v1"); if(!timestamp||!expected)return Promise.resolve(false);
    const manifest=`id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
    return Promise.resolve(safeEqual(createHmac("sha256",secret).update(manifest).digest("hex"),expected));
  }
  normalizeWebhook(payload: unknown): Promise<NormalizedProviderEvent> {
    const body=objectBody(payload),data=objectBody(body["data"]);
    return Promise.resolve({externalEventId:textValue(body["id"]),type:textValue(body["action"])||textValue(body["type"])||"unknown",
      providerPaymentId:data["id"]===undefined?null:asProviderPaymentId(data["id"]),status:null,
      occurredAt:typeof body["date_created"]==="string"?body["date_created"]:null});
  }
  async refund(input: RefundPaymentInput): Promise<{ providerPaymentId: ProviderPaymentId }> {
    this.assertWritesEnabled(); const key=requireIdempotencyKey(input.idempotencyKey);
    if(input.providerPaymentId.startsWith("ORD")){
      const response=await this.http(`${BASE_URL}/v1/orders/${encodeURIComponent(input.providerPaymentId)}/refund`,{method:"POST",headers:this.headers(key),body:JSON.stringify(input.amountCents===undefined?{}:{amount:centsToDecimal(input.amountCents).toFixed(2)})});
      await readJson(response); return {providerPaymentId:input.providerPaymentId};
    }
    const body=input.amountCents===undefined?{}:{amount:centsToDecimal(input.amountCents)};
    const response=await this.http(`${BASE_URL}/v1/payments/${encodeURIComponent(input.providerPaymentId)}/refunds`,{method:"POST",headers:this.headers(key),body:JSON.stringify(body)});
    await readJson(response); return {providerPaymentId:input.providerPaymentId};
  }
  private headers(idempotencyKey?:string):Record<string,string>{return {Authorization:`Bearer ${this.options.accessToken}`,"Content-Type":"application/json",...(idempotencyKey?{"X-Idempotency-Key":idempotencyKey}:{})};}
  private assertWritesEnabled():void{if(!this.options.writesEnabled)throw new Error("Operações de escrita Mercado Pago desabilitadas.");}
}
function firstPayment(body:Record<string,unknown>):Record<string,unknown>{const payments=objectBody(body["transactions"])["payments"];return Array.isArray(payments)&&payments[0]?objectBody(payments[0]):{};}
function orderStatus(value:string):PaymentStatus{switch(value.toLowerCase()){case"processed":return"captured";case"created":case"action_required":case"processing":return"pending";case"refunded":case"partially_refunded":return"refunded";case"failed":case"canceled":case"cancelled":case"expired":return"failed";default:throw new Error("Status de order Mercado Pago desconhecido.");}}
function signatureValue(signature:string,key:string):string|null{for(const part of signature.split(",")){const[name,value]=part.trim().split("=",2);if(name===key&&value)return value.trim();}return null;}
function textValue(value:unknown):string{return typeof value==="string"||typeof value==="number"?String(value):"";}
function textOrNull(value:unknown):string|null{return typeof value==="string"&&value?value:null;}
function objectBody(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
