import type {
  Campaign,
  CampaignMutationInput,
  MarketingScope,
} from "./types.ts";
import type { MarketingSqlExecutor } from "./repository.ts";
import {
  assertScope,
  CAMPAIGN_COLUMNS,
  mapCampaign,
  normalizeCampaignInput,
} from "./campaign-mapper.ts";

export async function createCampaign(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  raw: CampaignMutationInput,
  actorUserId: string | null,
): Promise<Campaign> {
  assertScope(scope);
  const input = normalizeCampaignInput(raw);
  const rows = await sql.query(
    `with inserted as (
       insert into public.marketing_campaigns
         (tenant_id,store_id,name,content,segment_type,scheduled_at)
       values ($1,$2,$3,$4,$5,$6)
       returning ${CAMPAIGN_COLUMNS}
     ), audit as (
       insert into public.audit_logs
         (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $7::uuid,$1::uuid,$2::uuid,'campaign.created','campaign',
         i.id::text,jsonb_build_object('segment_type',i.segment_type)
       from inserted i where $7::uuid is not null
       returning id
     )
     select i.*,0::integer as recipient_count from inserted i`,
    [
      scope.tenantId,
      scope.storeId,
      input.name,
      input.content,
      input.segmentType,
      input.scheduledAt,
      actorUserId,
    ],
  );
  if (!rows.length) throw new Error("Falha ao criar campanha");
  return mapCampaign(rows[0] as Record<string, unknown>);
}

export async function updateCampaign(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  id: string,
  raw: CampaignMutationInput,
  actorUserId: string | null,
): Promise<Campaign | null> {
  assertScope(scope);
  const input = normalizeCampaignInput(raw);
  const rows = await sql.query(
    `with updated as (
       update public.marketing_campaigns set
         name=$4,content=$5,segment_type=$6,scheduled_at=$7,updated_at=now()
       where tenant_id=$1 and store_id=$2 and id=$3 and status='draft'
       returning ${CAMPAIGN_COLUMNS}
     ), audit as (
       insert into public.audit_logs
         (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $8::uuid,$1::uuid,$2::uuid,'campaign.updated','campaign',
         u.id::text,jsonb_build_object('segment_type',u.segment_type)
       from updated u where $8::uuid is not null
       returning id
     )
     select u.*,0::integer as recipient_count from updated u`,
    [
      scope.tenantId,
      scope.storeId,
      id,
      input.name,
      input.content,
      input.segmentType,
      input.scheduledAt,
      actorUserId,
    ],
  );
  return rows.length ? mapCampaign(rows[0] as Record<string, unknown>) : null;
}

export async function cancelCampaign(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  id: string,
  actorUserId: string | null,
): Promise<Campaign | null> {
  assertScope(scope);
  const rows = await sql.query(
    `with cancelled as (
       update public.marketing_campaigns set
         status='cancelled',cancelled_at=coalesce(cancelled_at,now()),updated_at=now()
       where tenant_id=$1 and store_id=$2 and id=$3 and status<>'cancelled'
       returning ${CAMPAIGN_COLUMNS}
     ), recipients as (
       update public.marketing_campaign_recipients r
       set status='cancelled',updated_at=now()
       where r.tenant_id=$1 and r.store_id=$2 and r.campaign_id=$3
         and exists (select 1 from cancelled)
       returning r.id
     ), audit as (
       insert into public.audit_logs
         (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $4::uuid,$1::uuid,$2::uuid,'campaign.cancelled','campaign',
         c.id::text,'{}'::jsonb
       from cancelled c where $4::uuid is not null
       returning id
     )
     select c.*,
       (select count(*)::integer from public.marketing_campaign_recipients r
        where r.tenant_id=$1 and r.store_id=$2 and r.campaign_id=$3)
       as recipient_count
     from cancelled c`,
    [scope.tenantId, scope.storeId, id, actorUserId],
  );
  return rows.length ? mapCampaign(rows[0] as Record<string, unknown>) : null;
}

export async function prepareCampaign(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  id: string,
  actorUserId: string | null,
): Promise<Campaign | null> {
  assertScope(scope);
  const rows = await sql.query(
    `with prepared as (
       update public.marketing_campaigns set
         status=case when scheduled_at is not null and scheduled_at>now()
           then 'scheduled' else 'prepared' end,
         prepared_at=now(),updated_at=now()
       where tenant_id=$1 and store_id=$2 and id=$3 and status='draft'
       returning ${CAMPAIGN_COLUMNS}
     ), eligible as (
       select c.id as customer_id,p.scheduled_at
       from prepared p
       join public.customers c
         on c.tenant_id=p.tenant_id and c.store_id=p.store_id
       join public.marketing_consents mc
         on mc.tenant_id=c.tenant_id and mc.store_id=c.store_id
        and mc.customer_id=c.id and mc.status='opted_in'
       where p.segment_type='all'
         or (p.segment_type='with_orders' and exists (
           select 1 from public.orders o
           where o.tenant_id=c.tenant_id and o.store_id=c.store_id
             and o.customer_id=c.id
         ))
         or (p.segment_type='without_orders' and not exists (
           select 1 from public.orders o
           where o.tenant_id=c.tenant_id and o.store_id=c.store_id
             and o.customer_id=c.id
         ))
     ), inserted as (
       insert into public.marketing_campaign_recipients
         (tenant_id,store_id,campaign_id,customer_id,status,
          consent_snapshot_status,available_at)
       select $1::uuid,$2::uuid,$3::uuid,e.customer_id,'queued','opted_in',
         coalesce(e.scheduled_at,now())
       from eligible e
       on conflict (tenant_id,store_id,campaign_id,customer_id) do nothing
       returning id
     ), audit as (
       insert into public.audit_logs
         (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $4::uuid,$1::uuid,$2::uuid,
         case when p.status='scheduled'
           then 'campaign.scheduled' else 'campaign.prepared' end,
         'campaign',p.id::text,
         jsonb_build_object(
           'recipient_count',(select count(*) from inserted),
           'segment_type',p.segment_type
         )
       from prepared p where $4::uuid is not null
       returning id
     )
     select c.*,
       (select count(*)::integer from public.marketing_campaign_recipients r
        where r.tenant_id=$1 and r.store_id=$2 and r.campaign_id=$3)
       as recipient_count
     from public.marketing_campaigns c
     where c.tenant_id=$1 and c.store_id=$2 and c.id=$3
       and c.status in ('prepared','scheduled')`,
    [scope.tenantId, scope.storeId, id, actorUserId],
  );
  return rows.length ? mapCampaign(rows[0] as Record<string, unknown>) : null;
}
