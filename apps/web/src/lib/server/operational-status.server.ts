export interface OperationalStatusSql {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export class OperationalStatusError extends Error {
  constructor(readonly code: "TENANT_SUSPENDED" | "STORE_SUSPENDED" | "SCOPE_NOT_FOUND") {
    super(code === "TENANT_SUSPENDED" ? "White Label suspensa" : code === "STORE_SUSPENDED" ? "Loja suspensa" : "Escopo operacional não encontrado");
  }
}

export async function assertOperationalScope(
  sql: OperationalStatusSql,
  tenantId: string,
  storeId?: string | null,
): Promise<void> {
  const rows = await sql.query(
    `select t.status tenant_status,s.status store_status
     from public.tenants t
     left join public.stores s on s.tenant_id=t.id and s.id=$2::uuid
     where t.id=$1::uuid and ($2::uuid is null or s.id is not null) limit 1`,
    [tenantId, storeId ?? null],
  );
  const row = rows.at(0);
  if (!row) throw new OperationalStatusError("SCOPE_NOT_FOUND");
  if (row["tenant_status"] !== "active" && row["tenant_status"] !== "trial") throw new OperationalStatusError("TENANT_SUSPENDED");
  if (storeId && row["store_status"] !== "active") throw new OperationalStatusError("STORE_SUSPENDED");
}
