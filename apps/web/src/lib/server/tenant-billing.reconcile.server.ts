import { reconcilePaymentStatus } from "@white-label/payments/server";
import type { PaymentProviderName, ProviderPaymentId } from "@white-label/payments";
import type { ControlSql } from "./control-merchants.shared.server.ts";
import type { TenantProviderLoader } from "./tenant-billing.provider.server.ts";

export async function reconcileTenantMerchantPayment(
  sql: ControlSql,
  tenantId: string,
  storeId: string,
  paymentId: string,
  providers: TenantProviderLoader,
): Promise<{ status: string; changed: boolean }> {
  const rows = await sql.query(
    `select p.id::text,p.gateway_account_id::text,p.provider_payment_id,ga.provider
     from public.payments p
     join public.gateway_accounts ga on ga.id=p.gateway_account_id
     where p.id=$1::uuid and p.level='tenant_billing'
       and p.tenant_id=$2::uuid and p.store_id=$3::uuid
       and p.store_subscription_id is not null
       and ga.level='tenant_billing' and ga.tenant_id=p.tenant_id and ga.store_id is null
     limit 1`,
    [paymentId, tenantId, storeId],
  );
  const row = rows.at(0);
  if (!row) throw new Error("Pagamento tenant_billing não pertence ao tenant/store informado.");
  const gatewayId = requiredText(row, "gateway_account_id");
  const providerPaymentId = requiredText(row, "provider_payment_id") as ProviderPaymentId;
  const providerName = requiredText(row, "provider") as PaymentProviderName;
  const provider = await providers.load({ id: gatewayId, provider: providerName, tenantId });
  return reconcilePaymentStatus(sql, paymentId, gatewayId, provider, providerPaymentId);
}

function requiredText(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Campo inválido: ${key}`);
  return value;
}
