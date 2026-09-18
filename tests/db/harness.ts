// Harness REAL DATABASE: engine PostgreSQL genuíno em ambos os backends.
// - Padrão: PGlite (PostgreSQL WASM em-processo, mesma engine, sem infra).
// - Opcional: TEST_DATABASE_URL (PostgreSQL servidor/Supabase local).
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type Row = Record<string, unknown>;

export interface TestDb {
  backend: "pglite" | "server";
  query(sql: string, params?: unknown[]): Promise<Row[]>;
  execScript(sql: string): Promise<void>;
  execOne(sql: string): Promise<void>;
  close(): Promise<void>;
}

const MIGRATIONS = [
  "0001_foundation.sql",
  "0002_commerce_stubs.sql",
  "0003_rls.sql",
  "0004_composite_hardening.sql",
  "0005_membership_self_read.sql",
  "0006_rls_helpers_hardening.sql",
  "0007_storefront_catalog.sql",
  "0008_storefront_trial_window.sql",
  "0009_orders_inventory.sql",
  "0010_customers_marketing.sql",
  "0011_foundation_hardening.sql",
  "0012_commercial_plans_entitlements.sql",
  "0013_billing_events.sql",
  "0014_billing_level_hardening.sql",
  "0016_catalog_variant_integrity.sql",
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
    const result = (await this.need().query(sql, params as never[])) as { rows: Row[] };
    return result.rows;
  }

  async execOne(sql: string): Promise<void> {
    await this.need().query(sql);
  }

  async execScript(sql: string): Promise<void> {
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
  const files = readdirSync(migrationsDir()).filter((file) => file.endsWith(".sql")).sort();
  const missing = MIGRATIONS.filter((migration) => !files.includes(migration));
  if (missing.length > 0) throw new Error(`migrations ausentes: ${missing.join(",")}`);
  return MIGRATIONS;
}

const PRELUDE = `
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

const RLS_AUTO_ENABLE_SHIM = `
create or replace function public.rls_auto_enable()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$ begin null; end $$;
grant execute on function public.rls_auto_enable() to anon, authenticated;
`;

const TEST_ROLES = `
grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
grant execute on function private.is_tenant_member(uuid) to authenticated;
grant execute on function private.is_store_member(uuid) to authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;

export interface Harness {
  db: TestDb;
  asUser: <R>(
    uid: string | null,
    role: "anon" | "authenticated",
    fn: () => Promise<R>,
  ) => Promise<R>;
}

export async function setupDatabase(): Promise<Harness> {
  const url = process.env["TEST_DATABASE_URL"];
  let db: TestDb;
  if (url) {
    const server = new ServerDb();
    await server.open(url);
    db = server;
  } else {
    const pglite = new PGliteDb();
    await pglite.open();
    db = pglite;
  }

  await db.execScript(PRELUDE);
  await db.execScript(AUTH_SHIM);
  if (db.backend === "pglite") await db.execScript(RLS_AUTO_ENABLE_SHIM);
  for (const file of listMigrationFiles()) {
    await db.execScript(readFileSync(join(migrationsDir(), file), "utf8"));
  }
  await db.execScript(TEST_ROLES);

  const asUser = async <R>(
    uid: string | null,
    role: "anon" | "authenticated",
    fn: () => Promise<R>,
  ): Promise<R> => {
    await db.execOne(`set role ${role}`);
    await db.execOne(`select set_config('app.test_uid', '${uid ?? ""}', false)`);
    try {
      return await fn();
    } finally {
      await db.execOne("select set_config('app.test_uid', '', false)");
      await db.execOne("reset role");
    }
  };

  return { db, asUser };
}

export async function expectReject(promise: Promise<unknown>, label: string): Promise<void> {
  let rejected = false;
  try {
    await promise;
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`PostgreSQL NÃO rejeitou (deveria): ${label}`);
}
