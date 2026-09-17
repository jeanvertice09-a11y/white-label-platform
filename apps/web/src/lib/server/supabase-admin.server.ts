// SERVER-ONLY: conexão Postgres direta com service_role para queries administrativas.
// NUNCA importar no client bundle. Usado para ler memberships/domínios (RLS nega anon/authenticated).
import postgres from "postgres";
import type { SqlExecutor } from "@white-label/domains";

function assertServer(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g["window"] !== "undefined") {
    throw new Error("[supabase-admin] Módulo server-only vazou para o client.");
  }
}

function readAdminDbUrl(): string {
  assertServer();
  const url = process.env["SUPABASE_DB_URL"];
  if (!url) throw new Error("[supabase-admin] SUPABASE_DB_URL ausente (postgres://service_role:...@host:5432/postgres)");
  return url;
}

let cachedSql: ReturnType<typeof postgres> | null = null;

function getSql(): ReturnType<typeof postgres> {
  assertServer();
  if (!cachedSql) {
    const url = readAdminDbUrl();
    cachedSql = postgres(url, { max: 1, prepare: false });
  }
  return cachedSql;
}

/** Executor SQL que usa service_role (bypassa RLS) para ler memberships/domínios. */
export function createAdminSqlExecutor(): SqlExecutor {
  return {
    async query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
      const sqlFn = getSql();
      const rows = await sqlFn.unsafe(sql, params as never[]);
      return rows as Record<string, unknown>[];
    },
  };
}

/** Fecha a conexão (útil para testes/graceful shutdown). */
export async function closeAdminSql(): Promise<void> {
  if (cachedSql) {
    await cachedSql.end();
    cachedSql = null;
  }
}