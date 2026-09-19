import postgres from "postgres";
import { cleanupHomologationSeed, applyHomologationSeed } from "./seed.ts";
import type { HomologationRuntimeConfig } from "./model.ts";
import { expectedAssets, homologationPlan, validateRuntimeConfig } from "./plan.ts";
import { runHomologationPreflight } from "./preflight.ts";

interface DbClient {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  execScript(sql: string): Promise<void>;
  close(): Promise<void>;
}

function write(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function readConfig(): Promise<HomologationRuntimeConfig> {
  const path = process.env["HOMOLOGATION_CONFIG_FILE"];
  if (!path) throw new Error("HOMOLOGATION_CONFIG_FILE obrigatório");
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`config não encontrado: ${path}`);
  const config = JSON.parse(await file.text()) as HomologationRuntimeConfig;
  validateRuntimeConfig(config);
  return config;
}

function databaseUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL obrigatório");
  return url;
}

function openDb(url: string): DbClient {
  const client = postgres(url, { max: 1 });
  return {
    async query(sql, params = []) {
      const rows = await client.unsafe(sql, params as never[]);
      return rows;
    },
    async execScript(sql) { await client.unsafe(sql); },
    async close() { await client.end(); },
  };
}

function assertApplyConfirmation(): void {
  if (process.env["HOMOLOGATION_CONFIRM"] !== "KATALUU_HML_V1") throw new Error("HOMOLOGATION_CONFIRM=KATALUU_HML_V1 obrigatório");
  if (process.env["HOMOLOGATION_AUTH_READY"] !== "true") throw new Error("HOMOLOGATION_AUTH_READY=true obrigatório");
  if (process.env["HOMOLOGATION_DOMAINS_VERIFIED"] !== "true") throw new Error("HOMOLOGATION_DOMAINS_VERIFIED=true obrigatório");
  if (process.env["HOMOLOGATION_ASSETS_READY"] !== "true") throw new Error("HOMOLOGATION_ASSETS_READY=true obrigatório");
}

async function withDb<T>(fn: (db: DbClient) => Promise<T>): Promise<T> {
  const db = openDb(databaseUrl());
  try { return await fn(db); } finally { await db.close(); }
}

async function run(command: string | undefined): Promise<void> {
  if (command === "plan") { write(homologationPlan()); return; }
  if (command === "assets") { write(expectedAssets()); return; }
  if (command === "preflight") {
    const config = await readConfig();
    write(await withDb((db) => runHomologationPreflight(db, config)));
    return;
  }
  if (command === "apply") {
    assertApplyConfirmation();
    const config = await readConfig();
    await withDb((db) => applyHomologationSeed(db, config));
    write({ ok: true, action: "apply", version: "kataluu-homologation-v1" });
    return;
  }
  if (command === "cleanup") {
    if (process.env["HOMOLOGATION_CONFIRM"] !== "KATALUU_HML_V1_CLEANUP") throw new Error("HOMOLOGATION_CONFIRM=KATALUU_HML_V1_CLEANUP obrigatório");
    await withDb(cleanupHomologationSeed);
    write({ ok: true, action: "cleanup", version: "kataluu-homologation-v1" });
    return;
  }
  throw new Error("Uso: bun scripts/homologation/cli.ts <plan|assets|preflight|apply|cleanup>");
}

run(process.argv[2]).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
