// SERVER-ONLY: conexão Postgres direta para queries administrativas.
// NUNCA importar no client bundle. A URL deve apontar para o Transaction Pooler do Supabase.
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
  if (!url) {
    throw new Error(
      "[supabase-admin] SUPABASE_DB_URL ausente. Use a URI do Transaction Pooler do Supabase.",
    );
  }
  return url;
}

let cachedSql: ReturnType<typeof postgres> | null = null;

function getSql(): ReturnType<typeof postgres> {
  assertServer();
  if (!cachedSql) {
    cachedSql = postgres(readAdminDbUrl(), {
      max: 1,
      prepare: false,
      ssl: "require",
      connect_timeout: 10,
      idle_timeout: 20,
    });
  }
  return cachedSql;
}

/** Executor SQL administrativo server-side. */
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
