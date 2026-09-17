import type { DomainRecord, DomainStore } from "./resolver.ts";

/** Executor SQL mínimo (injetado: PGlite em testes, Postgres/Supabase no runtime). */
export interface SqlExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

interface DomainRow {
  id: unknown;
  tenant_id: unknown;
  store_id: unknown;
  hostname: unknown;
  type: unknown;
  status: unknown;
  verified_at: unknown;
}

function str(v: unknown, col: string): string {
  if (typeof v !== "string" || v.length === 0) throw new Error(`coluna inválida: ${col}`);
  return v;
}

function instant(v: unknown, col: string): string | null {
  if (v === null) return null;
  if (typeof v === "string" && v.length > 0) return v;
  if (v instanceof Date) return v.toISOString();
  throw new Error(`coluna inválida: ${col}`);
}

/**
 * Fonte autoritativa PostgreSQL p/ domínios. Leitura com service_role no
 * servidor (RLS nega anon/authenticated em domains). Hostname já normalizado.
 */
export class PostgresDomainStore implements DomainStore {
  constructor(private readonly sql: SqlExecutor) {}

  async findByHostname(hostname: string): Promise<DomainRecord | null> {
    const rows = await this.sql.query(
      `select id, tenant_id, store_id, hostname, type, status, verified_at
       from public.domains where hostname = $1 limit 1`,
      [hostname],
    );
    const r = rows[0] as unknown as DomainRow | undefined;
    if (!r) return null;
    return {
      id: str(r.id, "id"),
      tenantId: str(r.tenant_id, "tenant_id"),
      storeId: r.store_id === null ? null : str(r.store_id, "store_id"),
      hostname: str(r.hostname, "hostname"),
      type: str(r.type, "type") as DomainRecord["type"],
      status: str(r.status, "status") as DomainRecord["status"],
      verifiedAt: instant(r.verified_at, "verified_at"),
    };
  }
}
