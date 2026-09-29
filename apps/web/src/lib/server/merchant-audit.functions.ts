import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createMerchantOperationsContext } from "./operations-context.server.ts";

const querySchema = z.object({
  page: z.number().int().min(1).max(10_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(160).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export interface MerchantAuditRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface MerchantAuditPage {
  items: MerchantAuditRow[];
  page: number;
  pageSize: number;
  total: number;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function text(value: unknown, key: string): string {
  if (typeof value !== "string") throw new Error(`Campo de auditoria inválido: ${key}`);
  return value;
}

export const listMerchantAudit = createServerFn({ method: "GET" }).validator(querySchema).handler(async ({ data }): Promise<MerchantAuditPage> => {
  const current = await createMerchantOperationsContext(getRequestHost());
  const rows = await current.sql.query(
    `select id::text,action,resource_type,resource_id,actor_user_id::text,created_at::text,
       count(*) over()::integer as total_count
     from public.audit_logs
     where tenant_id=$1::uuid and store_id=$2::uuid
       and ($3::text is null or action ilike '%' || $3 || '%'
         or resource_type ilike '%' || $3 || '%'
         or coalesce(resource_id,'') ilike '%' || $3 || '%')
       and ($4::date is null or created_at >= $4::date)
       and ($5::date is null or created_at < $5::date + interval '1 day')
     order by created_at desc,id desc limit $6 offset $7`,
    [current.scope.tenantId, current.scope.storeId, data.search?.trim() || null, data.from ?? null, data.to ?? null, data.pageSize, (data.page - 1) * data.pageSize],
  );
  return {
    items: rows.map((row) => ({
      id: text(row["id"], "id"),
      action: text(row["action"], "action"),
      resourceType: text(row["resource_type"], "resource_type"),
      resourceId: optionalText(row["resource_id"]),
      actorUserId: optionalText(row["actor_user_id"]),
      createdAt: text(row["created_at"], "created_at"),
    })),
    page: data.page,
    pageSize: data.pageSize,
    total: rows.length ? Number(rows[0]?.["total_count"] ?? 0) : 0,
  };
});
