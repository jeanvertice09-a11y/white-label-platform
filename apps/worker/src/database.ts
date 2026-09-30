import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;
let client: SqlClient | null = null;

export interface WorkerSql {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

export function db(): SqlClient {
  if (client) return client;
  const url = process.env["SUPABASE_DB_URL"];
  if (!url) throw new Error("SUPABASE_DB_URL ausente no worker.");
  client = postgres(url, {
    max: Math.max(1, Number(process.env["WORKER_CONCURRENCY"] ?? 5)),
    prepare: false,
    ssl: "require",
  });
  return client;
}

export function workerSql(): WorkerSql {
  return {
    async query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
      const rows = await db().unsafe(sql, params as never[]);
      return rows as Record<string, unknown>[];
    },
  };
}

export async function closeWorkerDatabase(): Promise<void> {
  if (!client) return;
  await client.end();
  client = null;
}
