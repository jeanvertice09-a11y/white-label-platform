import type { AdminSql } from "./master-white-label.shared.server.ts";
import type { MasterAuditFilters, MasterAuditResult, MasterAuditRow } from "./master-audit.types.ts";

type Row = Record<string, unknown>;

function text(row: Row, key: string): string { return typeof row[key] === "string" ? row[key] as string : ""; }
function nullableText(row: Row, key: string): string | null { return typeof row[key] === "string" ? row[key] as string : null; }
function numberValue(row: Row, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function mapRow(row: Row): MasterAuditRow {
  return {
    id: text(row, "id"), action: text(row, "action"), resourceType: text(row, "resource_type"),
    resourceId: nullableText(row, "resource_id"), tenantId: nullableText(row, "tenant_id"),
    tenantName: nullableText(row, "tenant_name"), storeId: nullableText(row, "store_id"),
    storeName: nullableText(row, "store_name"), actorUserId: nullableText(row, "actor_user_id"),
    createdAt: text(row, "created_at"),
  };
}

export async function listMasterAudit(
  sql: AdminSql,
  input: MasterAuditFilters,
): Promise<MasterAuditResult> {
  const offset = (input.page - 1) * input.pageSize;
  const rows = await sql.query(
    `select a.id::text,a.action,a.resource_type,a.resource_id,
       a.tenant_id::text,t.name tenant_name,a.store_id::text,st.name store_name,
       a.actor_user_id::text,a.created_at::text,count(*) over()::integer total_count
     from public.audit_logs a
     left join public.tenants t on t.id=a.tenant_id
     left join public.stores st on st.id=a.store_id and st.tenant_id=a.tenant_id
     where ($1='' or a.action ilike '%'||$1||'%')
       and ($2='' or coalesce(a.actor_user_id::text,'') ilike '%'||$2||'%')
       and ($3='' or coalesce(a.tenant_id::text,'') ilike '%'||$3||'%'
         or coalesce(t.name,'') ilike '%'||$3||'%' or coalesce(t.slug,'') ilike '%'||$3||'%')
       and ($4='' or coalesce(a.store_id::text,'') ilike '%'||$4||'%'
         or coalesce(st.name,'') ilike '%'||$4||'%' or coalesce(st.slug,'') ilike '%'||$4||'%')
       and ($5='' or a.resource_type ilike '%'||$5||'%'
         or coalesce(a.resource_id,'') ilike '%'||$5||'%')
       and ($6='' or a.created_at >= nullif($6,'')::date)
       and ($7='' or a.created_at < nullif($7,'')::date + interval '1 day')
     order by a.created_at desc,a.id desc limit $8 offset $9`,
    [input.action, input.actor, input.tenant, input.store, input.resource, input.from, input.to, input.pageSize, offset],
  );
  const total = rows.at(0) ? numberValue(rows[0] ?? {}, "total_count") : 0;
  return {
    items: rows.map(mapRow), total, page: input.page, pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
  };
}
