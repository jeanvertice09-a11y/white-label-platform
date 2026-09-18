import type {
  MarketingConsent,
  MarketingScope,
  ProviderBoundaryRecipient,
  RecordMarketingConsentInput,
} from "./types.ts";
import type { MarketingSqlExecutor } from "./repository.ts";
import { assertScope, dateText, text } from "./campaign-mapper.ts";

export async function recordMarketingConsent(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  input: RecordMarketingConsentInput,
): Promise<MarketingConsent> {
  assertScope(scope);
  const source = input.source.trim();
  if (!source || source.length > 80) {
    throw new Error("Origem do consentimento inválida");
  }
  const rows = await sql.query(
    `insert into public.marketing_consents
       (tenant_id,store_id,customer_id,status,source,granted_at,revoked_at)
     values (
       $1,$2,$3,$4,$5,
       case when $4='opted_in' then now() else null end,
       case when $4='opted_out' then now() else null end
     )
     on conflict (tenant_id,store_id,customer_id) do update set
       status=excluded.status,source=excluded.source,
       granted_at=case when excluded.status='opted_in' then now()
         else marketing_consents.granted_at end,
       revoked_at=case when excluded.status='opted_out' then now() else null end,
       updated_at=now()
     returning id,tenant_id,store_id,customer_id,status,source,
       granted_at,revoked_at,updated_at`,
    [scope.tenantId, scope.storeId, input.customerId, input.status, source],
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error("Falha ao registrar consentimento");
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    customerId: text(row, "customer_id"),
    status: text(row, "status") as MarketingConsent["status"],
    source: text(row, "source"),
    grantedAt: dateText(row, "granted_at"),
    revokedAt: dateText(row, "revoked_at"),
    updatedAt: dateText(row, "updated_at") ?? "",
  };
}

export async function listProviderBoundaryRecipients(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  campaignId: string,
  rawLimit: number,
): Promise<ProviderBoundaryRecipient[]> {
  assertScope(scope);
  const limit = Number.isInteger(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 200)
    : 100;
  const rows = await sql.query(
    `with blocked as (
       update public.marketing_campaign_recipients r
       set status='blocked_consent',blocked_at=now(),updated_at=now()
       where r.tenant_id=$1 and r.store_id=$2 and r.campaign_id=$3
         and r.status='queued' and r.available_at<=now()
         and not exists (
           select 1 from public.marketing_consents mc
           where mc.tenant_id=r.tenant_id and mc.store_id=r.store_id
             and mc.customer_id=r.customer_id and mc.status='opted_in'
         )
       returning r.id
     )
     select r.id as recipient_id,r.campaign_id,r.customer_id
     from public.marketing_campaign_recipients r
     join public.marketing_campaigns c
       on c.tenant_id=r.tenant_id and c.store_id=r.store_id
      and c.id=r.campaign_id
     join public.marketing_consents mc
       on mc.tenant_id=r.tenant_id and mc.store_id=r.store_id
      and mc.customer_id=r.customer_id and mc.status='opted_in'
     where r.tenant_id=$1 and r.store_id=$2 and r.campaign_id=$3
       and r.status='queued' and r.available_at<=now()
       and c.status in ('prepared','scheduled')
     order by r.available_at,r.id limit $4`,
    [scope.tenantId, scope.storeId, campaignId, limit],
  );
  return rows.map((row) => ({
    recipientId: text(row, "recipient_id"),
    campaignId: text(row, "campaign_id"),
    customerId: text(row, "customer_id"),
  }));
}
