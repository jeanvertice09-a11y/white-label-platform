import postgres from "postgres";
import type {
  CatalogAdminSqlExecutor,
  CatalogSqlExecutor,
} from "@white-label/catalog";

function assertServer(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g["window"] !== "undefined") {
    throw new Error("[catalog-db] módulo server-only vazou para o client");
  }
}

function readDbUrl(): string {
  assertServer();
  const url = process.env["SUPABASE_DB_URL"];
  if (!url) throw new Error("[catalog-db] SUPABASE_DB_URL ausente");
  return url;
}

let cachedSql: ReturnType<typeof postgres> | null = null;

function getSql(): ReturnType<typeof postgres> {
  assertServer();
  if (!cachedSql) {
    cachedSql = postgres(readDbUrl(), {
      max: 3,
      prepare: false,
      idle_timeout: 20,
    });
  }
  return cachedSql;
}

function executorFor(
  sql: ReturnType<typeof postgres>,
): CatalogSqlExecutor {
  return {
    async query(query: string, params: unknown[]): Promise<Record<string, unknown>[]> {
      const rows = await sql.unsafe(query, params as never[]);
      return rows as Record<string, unknown>[];
    },
  };
}

export function createCatalogSqlExecutor(): CatalogSqlExecutor {
  return executorFor(getSql());
}

export function createCatalogAdminSqlExecutor(): CatalogAdminSqlExecutor {
  const sql = getSql();
  return {
    ...executorFor(sql),
    async transaction<T>(
      run: (tx: CatalogSqlExecutor) => Promise<T>,
    ): Promise<T> {
      return sql.begin(async (tx) => {
        const scopedTx: CatalogSqlExecutor = {
          async query(query: string, params: unknown[]) {
            const rows = await tx.unsafe(query, params as never[]);
            return rows as Record<string, unknown>[];
          },
        };
        return run(scopedTx);
      });
    },
  };
}

export async function closeCatalogSql(): Promise<void> {
  if (cachedSql) {
    await cachedSql.end();
    cachedSql = null;
  }
}
