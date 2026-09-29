import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createMerchantOperationsContext } from "./operations-context.server.ts";
import { createTenantMerchantCharge } from "./tenant-billing.charge.server.ts";
import { createTenantProviderLoader } from "./tenant-billing.provider.server.ts";

const profileSchema=z.object({
  legalName:z.string().trim().min(2).max(160),
  taxId:z.string().transform(v=>v.replace(/\D/g,"")).refine(v=>v.length===11||v.length===14,"CPF/CNPJ inválido"),
  billingEmail:z.string().trim().email().max(254),
});

export const getMerchantSubscriptionBilling=createServerFn({method:"GET"}).handler(async()=>{
  const ctx=await createMerchantOperationsContext(getRequestHost());
  const rows=await ctx.sql.query(`select s.id::text subscription_id,s.status,s.trial_ends_at::text,s.current_period_ends_at::text,
    p.name plan_name,p.price_cents,p.billing_interval,
    ga.provider,
    bp.legal_name,bp.tax_id,bp.billing_email,
    pay.id::text payment_id,pay.status payment_status,pay.provider_payment_id
    from public.store_subscriptions s
    join public.tenant_plans p on p.tenant_id=s.tenant_id and p.id=s.tenant_plan_id
    left join public.gateway_accounts ga on ga.tenant_id=s.tenant_id and ga.level='tenant_billing' and ga.store_id is null and ga.status='active'
    left join public.store_billing_profiles bp on bp.tenant_id=s.tenant_id and bp.store_id=s.store_id
    left join lateral (select x.id,x.status,x.provider_payment_id from public.payments x
      where x.level='tenant_billing' and x.tenant_id=s.tenant_id and x.store_id=s.store_id and x.store_subscription_id=s.id
      order by x.created_at desc limit 1) pay on true
    where s.tenant_id=$1::uuid and s.store_id=$2::uuid
    order by case when s.status in ('trialing','active','past_due','suspended') then 0 else 1 end,s.created_at desc limit 1`,
    [ctx.scope.tenantId,ctx.scope.storeId]);
  if(rows.length===0)return null; const r=rows[0];
  const str=(k:string)=>typeof r[k]==="string"?r[k]:null;
  const num=(k:string)=>Number.isSafeInteger(Number(r[k]))?Number(r[k]):0;
  return {subscription_id:str("subscription_id"),status:str("status"),trial_ends_at:str("trial_ends_at"),current_period_ends_at:str("current_period_ends_at"),plan_name:str("plan_name"),price_cents:num("price_cents"),billing_interval:str("billing_interval"),provider:str("provider"),legal_name:str("legal_name"),tax_id:str("tax_id"),billing_email:str("billing_email"),payment_id:str("payment_id"),payment_status:str("payment_status"),provider_payment_id:str("provider_payment_id")};
});

export const saveMerchantBillingProfile=createServerFn({method:"POST"}).validator(profileSchema).handler(async({data})=>{
  const ctx=await createMerchantOperationsContext(getRequestHost());
  await ctx.sql.query(`insert into public.store_billing_profiles(tenant_id,store_id,legal_name,tax_id,billing_email)
    values($1::uuid,$2::uuid,$3,$4,$5)
    on conflict(tenant_id,store_id) do update set legal_name=excluded.legal_name,tax_id=excluded.tax_id,billing_email=excluded.billing_email,updated_at=now()`,
    [ctx.scope.tenantId,ctx.scope.storeId,data.legalName,data.taxId,data.billingEmail]);
  return {ok:true};
});

export const createMerchantSubscriptionPayment=createServerFn({method:"POST"}).handler(async()=>{
  const ctx=await createMerchantOperationsContext(getRequestHost());
  const rows=await ctx.sql.query(`select id::text from public.store_subscriptions where tenant_id=$1::uuid and store_id=$2::uuid
    and status in ('trialing','active','past_due') order by created_at desc limit 1`,[ctx.scope.tenantId,ctx.scope.storeId]);
  const id=rows[0]?.["id"]; if(typeof id!=="string") throw new Error("Assinatura cobrável não encontrada.");
  return createTenantMerchantCharge(ctx.sql,ctx.userId,ctx.scope.tenantId,ctx.scope.storeId,id,createTenantProviderLoader(ctx.sql));
});
