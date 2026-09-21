interface DashboardSql {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export interface StorePlanScope {
  tenantId: string;
  storeId: string;
}

export interface PlanSummary {
  name: string | null;
  slug: string | null;
  status: string;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function loadStoreCommercialPlanSummary(
  sql: DashboardSql,
  scope: StorePlanScope,
): Promise<PlanSummary | null> {
  const rows = await sql.query(
    `select p.name,p.slug,s.status
     from public.store_subscriptions s
     join public.tenant_plans p
       on p.tenant_id=s.tenant_id and p.id=s.tenant_plan_id
     where s.tenant_id=$1::uuid and s.store_id=$2::uuid
     order by s.created_at desc,s.id desc limit 1`,
    [scope.tenantId, scope.storeId],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const status = row["status"];
  if (typeof status !== "string") throw new Error("Status de assinatura inválido");
  return {
    name: optionalText(row["name"]),
    slug: optionalText(row["slug"]),
    status,
  };
}
