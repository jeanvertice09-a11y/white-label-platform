// SERVER-ONLY: conexão Postgres direta para queries administrativas.
// NUNCA importar no client bundle. A URL deve apontar para o Transaction Pooler do Supabase.
import postgres from "postgres";
import type { SqlExecutor } from "@white-label/domains";
import { createAdminQueryGuard } from "./admin-query-guard.server.ts";

const ADMIN_DB_TIMEOUT_SECONDS = 10;
const ADMIN_DB_QUERY_TIMEOUT_MS = ADMIN_DB_TIMEOUT_SECONDS * 1000;
const ADMIN_DB_DESTROY_TIMEOUT_SECONDS = 1;
const adminQueryGuard = createAdminQueryGuard(ADMIN_DB_QUERY_TIMEOUT_MS);

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
      connect_timeout: ADMIN_DB_TIMEOUT_SECONDS,
      idle_timeout: 20,
    });
  }
  return cachedSql;
}

function retireTimedOutSql(sqlFn: ReturnType<typeof postgres>): void {
  if (cachedSql === sqlFn) cachedSql = null;
  void sqlFn.end({ timeout: ADMIN_DB_DESTROY_TIMEOUT_SECONDS }).catch(() => undefined);
  console.error(
    `[supabase-admin] consulta excedeu ${String(ADMIN_DB_QUERY_TIMEOUT_MS)}ms; conexão descartada`,
  );
}

/** Executor SQL administrativo server-side com serialização e deadline fail-fast. */
export function createAdminSqlExecutor(): SqlExecutor {
  return {
    async query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
      let activeSql: ReturnType<typeof postgres> | null = null;
      return adminQueryGuard.run(
        async () => {
          activeSql = getSql();
          const rows = await activeSql.unsafe(sql, params as never[]).execute();
          return rows as Record<string, unknown>[];
        },
        () => {
          if (activeSql) retireTimedOutSql(activeSql);
        },
      );
    },
  };
}

/** Fecha a conexão (útil para testes/graceful shutdown). */
export async function closeAdminSql(): Promise<void> {
  if (cachedSql) {
    await cachedSql.end({ timeout: ADMIN_DB_DESTROY_TIMEOUT_SECONDS });
    cachedSql = null;
  }
}
