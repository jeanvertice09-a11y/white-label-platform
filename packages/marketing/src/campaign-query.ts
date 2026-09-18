import type {
  CampaignDetail,
  CampaignListQuery,
  CampaignPage,
  CampaignRecipient,
  MarketingScope,
} from "./types.ts";
import type { MarketingSqlExecutor } from "./repository.ts";
import {
  assertScope,
  CAMPAIGN_COLUMNS,
  mapCampaign,
  mapHistory,
  mapRecipient,
} from "./campaign-mapper.ts";

function pageNumber(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function pageSize(value: number): number {
  return Number.isInteger(value) && value > 0 ? Math.min(value, 100) : 20;
}

export async function listCampaignPage(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  query: CampaignListQuery,
): Promise<CampaignPage> {
  assertScope(scope);
  const page = pageNumber(query.page);
  const size = pageSize(query.pageSize);
  const search = query.search?.trim() || null;
  const columns = CAMPAIGN_COLUMNS.split(",").join(",c.");
  const rows = await sql.query(
    `select c.${columns},
       count(r.id)::integer as recipient_count,
       count(*) over()::integer as total_count
     from public.marketing_campaigns c
     left join public.marketing_campaign_recipients r
       on r.tenant_id=c.tenant_id and r.store_id=c.store_id
      and r.campaign_id=c.id
     where c.tenant_id=$1 and c.store_id=$2
       and ($3::text is null or c.name ilike '%'||$3||'%')
     group by c.id,c.tenant_id,c.store_id
     order by c.created_at desc,c.id desc
     limit $4 offset $5`,
    [scope.tenantId, scope.storeId, search, size, (page - 1) * size],
  );
  return {
    items: rows.map(mapCampaign),
    page,
    pageSize: size,
    total: rows.length ? Number(rows[0]?.["total_count"] ?? 0) : 0,
  };
}

export async function getCampaignById(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  id: string,
): Promise<CampaignDetail | null> {
  assertScope(scope);
  const columns = CAMPAIGN_COLUMNS.split(",").join(",c.");
  const rows = await sql.query(
    `select c.${columns},count(r.id)::integer as recipient_count
     from public.marketing_campaigns c
     left join public.marketing_campaign_recipients r
       on r.tenant_id=c.tenant_id and r.store_id=c.store_id
      and r.campaign_id=c.id
     where c.tenant_id=$1 and c.store_id=$2 and c.id=$3
     group by c.id,c.tenant_id,c.store_id`,
    [scope.tenantId, scope.storeId, id],
  );
  if (!rows.length) return null;

  const recipientRows = await sql.query(
    `select r.id,r.tenant_id,r.store_id,r.campaign_id,r.customer_id,r.status,
       r.available_at,r.prepared_at,r.blocked_at,c.name as customer_name
     from public.marketing_campaign_recipients r
     join public.customers c
       on c.tenant_id=r.tenant_id and c.store_id=r.store_id
      and c.id=r.customer_id
     where r.tenant_id=$1 and r.store_id=$2 and r.campaign_id=$3
     order by r.prepared_at desc,r.id desc limit 200`,
    [scope.tenantId, scope.storeId, id],
  );
  const historyRows = await sql.query(
    `select action,created_at
     from public.audit_logs
     where tenant_id=$1 and store_id=$2
       and resource_type='campaign' and resource_id=$3
     order by created_at,id`,
    [scope.tenantId, scope.storeId, id],
  );
  return {
    ...mapCampaign(rows[0] as Record<string, unknown>),
    recipients: recipientRows.map(mapRecipient),
    history: mapHistory(historyRows),
  };
}

export async function getCampaignRecipientById(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  id: string,
): Promise<CampaignRecipient | null> {
  assertScope(scope);
  const rows = await sql.query(
    `select r.id,r.tenant_id,r.store_id,r.campaign_id,r.customer_id,r.status,
       r.available_at,r.prepared_at,r.blocked_at,c.name as customer_name
     from public.marketing_campaign_recipients r
     join public.customers c
       on c.tenant_id=r.tenant_id and c.store_id=r.store_id
      and c.id=r.customer_id
     where r.tenant_id=$1 and r.store_id=$2 and r.id=$3
     limit 1`,
    [scope.tenantId, scope.storeId, id],
  );
  return rows.length ? mapRecipient(rows[0] as Record<string, unknown>) : null;
}
