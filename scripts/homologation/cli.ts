import { dirname, isAbsolute, resolve } from "node:path";
import postgres from "postgres";
import { buildAssetManifestTemplate } from "./asset-manifest.ts";
import { verifyPublishedAssets } from "./assets-verify.ts";
import { cleanupHomologationSeed, applyHomologationSeed } from "./seed.ts";
import type { HomologationMediaMode, HomologationRuntimeConfig, ResolvedAsset } from "./model.ts";
import { homologationPlan, validateRuntimeConfig } from "./plan.ts";
import { runHomologationPreflight } from "./preflight.ts";

interface DbClient {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  execScript(sql: string): Promise<void>;
  close(): Promise<void>;
}

function write(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function readAssetManifest(configPath: string, manifestPath: string): Promise<Partial<Record<string, ResolvedAsset>>> {
  const path = isAbsolute(manifestPath) ? manifestPath : resolve(dirname(configPath), manifestPath);
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`manifesto de assets não encontrado: ${path}`);
  const parsed = JSON.parse(await file.text()) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("manifesto de assets inválido");
  return parsed;
}

async function readConfig(mediaMode: HomologationMediaMode): Promise<HomologationRuntimeConfig> {
  const path = process.env["HOMOLOGATION_CONFIG_FILE"];
  if (!path) throw new Error("HOMOLOGATION_CONFIG_FILE obrigatório");
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`config não encontrado: ${path}`);
  const config = JSON.parse(await file.text()) as HomologationRuntimeConfig;
  if (mediaMode === "required" && config.assetManifestFile) {
    config.resolvedAssets = await readAssetManifest(path, config.assetManifestFile);
  }
  validateRuntimeConfig(config, { mediaMode });
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

function assertCoreApplyConfirmation(): void {
  if (process.env["HOMOLOGATION_CONFIRM"] !== "KATALUU_HML_V1") throw new Error("HOMOLOGATION_CONFIRM=KATALUU_HML_V1 obrigatório");
  if (process.env["HOMOLOGATION_AUTH_READY"] !== "true") throw new Error("HOMOLOGATION_AUTH_READY=true obrigatório");
  if (process.env["HOMOLOGATION_DOMAINS_VERIFIED"] !== "true") throw new Error("HOMOLOGATION_DOMAINS_VERIFIED=true obrigatório");
}

function assertFullApplyConfirmation(): void {
  assertCoreApplyConfirmation();
  if (process.env["HOMOLOGATION_ASSETS_READY"] !== "true") throw new Error("HOMOLOGATION_ASSETS_READY=true obrigatório");
}

function assertDeferredMediaConfirmation(): void {
  assertCoreApplyConfirmation();
  if (process.env["HOMOLOGATION_MEDIA_DEFERRED"] !== "KATALUU_HML_MEDIA_DEFERRED") {
    throw new Error("HOMOLOGATION_MEDIA_DEFERRED=KATALUU_HML_MEDIA_DEFERRED obrigatório");
  }
}

async function withDb<T>(fn: (db: DbClient) => Promise<T>): Promise<T> {
  const db = openDb(databaseUrl());
  try { return await fn(db); } finally { await db.close(); }
}

async function productionPreflight(config: HomologationRuntimeConfig): Promise<Record<string, unknown>> {
  const database = await withDb((db) => runHomologationPreflight(db, config, { mediaMode: "required" }));
  const media = await verifyPublishedAssets(config);
  return { database, media };
}

async function run(command: string | undefined): Promise<void> {
  if (command === "plan") { write(homologationPlan()); return; }
  if (command === "assets") { write(buildAssetManifestTemplate()); return; }
  if (command === "preflight") {
    const config = await readConfig("deferred");
    const database = await withDb((db) => runHomologationPreflight(db, config, { mediaMode: "deferred" }));
    write({ database, media: { mode: "deferred", ready: false, pending: true } });
    return;
  }
  if (command === "preflight-production") {
    const config = await readConfig("required");
    write(await productionPreflight(config));
    return;
  }
  if (command === "apply") {
    assertFullApplyConfirmation();
    const config = await readConfig("required");
    await verifyPublishedAssets(config);
    await withDb((db) => applyHomologationSeed(db, config, { mediaMode: "required" }));
    write({ ok: true, action: "apply", version: "kataluu-homologation-v1", media: "required" });
    return;
  }
  if (command === "apply-functional") {
    assertDeferredMediaConfirmation();
    const config = await readConfig("deferred");
    await withDb((db) => applyHomologationSeed(db, config, { mediaMode: "deferred" }));
    write({
      ok: true,
      action: "apply-functional",
      version: "kataluu-homologation-v1",
      media: "deferred",
      mediaPending: true,
    });
    return;
  }
  if (command === "cleanup") {
    if (process.env["HOMOLOGATION_CONFIRM"] !== "KATALUU_HML_V1_CLEANUP") throw new Error("HOMOLOGATION_CONFIRM=KATALUU_HML_V1_CLEANUP obrigatório");
    await withDb(cleanupHomologationSeed);
    write({ ok: true, action: "cleanup", version: "kataluu-homologation-v1" });
    return;
  }
  throw new Error("Uso: bun scripts/homologation/cli.ts <plan|assets|preflight|preflight-production|apply|apply-functional|cleanup>");
}

run(process.argv[2]).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
