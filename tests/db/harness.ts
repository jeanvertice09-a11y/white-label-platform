// Harness REAL DATABASE: engine PostgreSQL genuíno em ambos os backends.
// - Padrão: PGlite (PostgreSQL WASM em-processo, mesma engine, sem infra).
// - Opcional: TEST_DATABASE_URL (PostgreSQL servidor/Supabase local,
//   conexão superuser p/ criar roles de teste).
// Diferença honesta vs Supabase: sem GoTrue — auth.uid() é um shim de TESTE
// (GUC app.test_uid) criado aqui, NUNCA em migration de produção.
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type Row = Record<string, unknown>;

export interface TestDb {
  backend: "pglite" | "server";
  query(sql: string, params?: unknown[]): Promise<Row[]>;
  execScript(sql: string): Promise<void>;
  /** Statement único na MESMA sessão das queries (SET/RESET). */
  execOne(sql: string): Promise<void>;
  close(): Promise<void>;
}

const MIGRATIONS = [
  "0001_foundation.sql",
  "0002_commerce_stubs.sql",
  "0003_rls.sql",
  "0004_composite_hardening.sql",
  "0005_membership_self_read.sql",
];

class PGliteDb implements TestDb {
  readonly backend = "pglite" as const;
  private db: InstanceType<typeof PGlite> | null = null;

  async open(): Promise<void> {
    await Promise.resolve();
    this.db = new PGlite();
  }
  private need(): InstanceType<typeof PGlite> {
    if (!this.db) throw new Error("PGlite não aberto");
    return this.db;
  }
  async query(sql: string, params?: unknown[]): Promise<Row[]> {
    const r = (await this.need().query(sql, params as never[])) as { rows: Row[] };
    return r.rows;
  }
  async execOne(sql: string): Promise<void> {
    await this.need().query(sql);
  }
  async execScript(sql: string): Promise<void> {
    // PGlite não empacota pgcrypto; gen_random_uuid() é core do PG13+,
    // então a linha de extension (necessária no Supabase) é removida aqui.
    // O arquivo de migration em disco permanece VERBATIM.
    await this.need().exec(sql.replace(/create extension[^;]+;/gi, "-- pgcrypto: provido pelo servidor"));
  }
  async close(): Promise<void> {
    await this.db?.close();
    this.db = null;
  }
}

class ServerDb implements TestDb {
  readonly backend = "server" as const;
  private sql: ReturnType<typeof postgres> | null = null;

  async open(url: string): Promise<void> {
    await Promise.resolve();
    this.sql = postgres(url, { max: 1 });
  }
  private need(): ReturnType<typeof postgres> {
    if (!this.sql) throw new Error("conexão não aberta");
    return this.sql;
  }
  async query(sql: string, params?: unknown[]): Promise<Row[]> {
    const rows = await this.need().unsafe(sql, params as never[]);
    return rows as Row[];
  }
  async execOne(sql: string): Promise<void> {
    await this.need().unsafe(sql);
  }
  async execScript(sql: string): Promise<void> {
    await this.need().unsafe(sql);
  }
  async close(): Promise<void> {
    await this.sql?.end();
    this.sql = null;
  }
}

function migrationsDir(): string {
  return join(import.meta.dir, "..", "..", "supabase", "migrations");
}

export function listMigrationFiles(): string[] {
  const files = readdirSync(migrationsDir()).filter((f) => f.endsWith(".sql")).sort();
  const missing = MIGRATIONS.filter((m) => !files.includes(m));
  if (missing.length > 0) throw new Error(`migrations ausentes: ${missing.join(",")}`);
  return MIGRATIONS;
}

const PRELUDE = `
-- Papeis pre-existentes no Supabase (anon/authenticated/service_role);
-- criados aqui para que 0003/0005 referenciem-nos. Somente setup de teste.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
`;

const AUTH_SHIM = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('app.test_uid', true), '')::uuid $$;
`;

const TEST_ROLES = `
-- Espelha o Supabase: PostgREST assume role anon/authenticated do JWT.
-- RLS é testada com esses papéis reais + GUC app.test_uid como "claims".
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.is_store_member(uuid) to authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;

export interface Harness {
  db: TestDb;
  /** Executa como role real (anon/authenticated) com app.test_uid = uid (RLS enforced). */
  asUser: <R>(uid: string | null, role: "anon" | "authenticated", fn: () => Promise<R>) => Promise<R>;
}

export async function setupDatabase(): Promise<Harness> {
  const url = process.env["TEST_DATABASE_URL"];
  let db: TestDb;
  if (url) {
    const s = new ServerDb();
    await s.open(url);
    db = s;
  } else {
    const p = new PGliteDb();
    await p.open();
    db = p;
  }
  // Shim ANTES das migrations: no Supabase o schema auth (GoTrue) pre-existe;
  // aqui o teste o cria primeiro para que 0003 referencie auth.uid().
  await db.execScript(PRELUDE);
  await db.execScript(AUTH_SHIM);
  for (const f of listMigrationFiles()) {
    await db.execScript(readFileSync(join(migrationsDir(), f), "utf8"));
  }
  await db.execScript(TEST_ROLES);
  const asUser = async <R>(
    uid: string | null,
    role: "anon" | "authenticated",
    fn: () => Promise<R>,
  ): Promise<R> => {
    // execOne: mesma sessão das queries (exec multi-statement pode usar outra sessão).
    await db.execOne(`set role ${role}`);
    await db.execOne(`select set_config('app.test_uid', '${uid ?? ""}', false)`);
    try {
      return await fn();
    } finally {
      await db.execOne(`select set_config('app.test_uid', '', false)`);
      await db.execOne(`reset role`);
    }
  };
  return { db, asUser };
}

/** Espera rejeição do PostgreSQL (FK/CHECK/trigger/RLS-write). */
export async function expectReject(p: Promise<unknown>, label: string): Promise<void> {
  let ok = false;
  try {
    await p;
  } catch {
    ok = true;
  }
  if (!ok) throw new Error(`PostgreSQL NÃO rejeitou (deveria): ${label}`);
}
