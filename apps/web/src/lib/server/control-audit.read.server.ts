import type { ControlSql } from "./control-merchants.shared.server.ts";
import type { ControlAuditFilters, ControlAuditResult, ControlAuditRow } from "./control-audit.types.ts";

type Row = Record<string, unknown>;
function text(row: Row, key: string): string { return typeof row[key] === "string" ? row[key] as string : ""; }
function nullableText(row: Row, key: string): string | null { return typeof row[key] === "string" ? row[key] as string : null; }
function numberValue(row: Row, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function mapRow(row: Row): ControlAuditRow {
  return {
    id: text(row, "id"), action: text(row, "action"), resourceType: text(row, "resource_type"),
    resourceId: nullableText(row, "resource_id"), storeId: nullableText(row, "store_id"),
    storeName: nullableText(row, "store_name"), actorUserId: nullableText(row, "actor_user_id"),
    createdAt: text(row, "created_at"),
  };
}

export async function listControlAudit(
  sql: ControlSql,
  tenantId: string,
  input: ControlAuditFilters,
): Promise<ControlAuditResult> {
  const offset = (input.page - 1) * input.pageSize;
  const rows = await sql.query(
    `select a.id::text,a.action,a.resource_type,a.resource_id,a.store_id::text,
       st.name store_name,a.actor_user_id::text,a.created_at::text,count(*) over()::integer total_count
     from public.audit_logs a
     left join public.stores st on st.tenant_id=a.tenant_id and st.id=a.store_id
     where a.tenant_id=$1::uuid
       and ($2='' or a.action ilike '%'||$2||'%')
       and ($3='' or coalesce(a.actor_user_id::text,'') ilike '%'||$3||'%')
       and ($4='' or coalesce(a.store_id::text,'') ilike '%'||$4||'%'
         or coalesce(st.name,'') ilike '%'||$4||'%' or coalesce(st.slug,'') ilike '%'||$4||'%')
       and ($5='' or a.resource_type ilike '%'||$5||'%'
         or coalesce(a.resource_id,'') ilike '%'||$5||'%')
       and ($6='' or a.created_at >= nullif($6,'')::date)
       and ($7='' or a.created_at < nullif($7,'')::date + interval '1 day')
     order by a.created_at desc,a.id desc limit $8 offset $9`,
    [tenantId, input.action, input.actor, input.store, input.resource, input.from, input.to, input.pageSize, offset],
  );
  const total = rows.at(0) ? numberValue(rows[0] ?? {}, "total_count") : 0;
  return {
    items: rows.map(mapRow), total, page: input.page, pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
  };
}
