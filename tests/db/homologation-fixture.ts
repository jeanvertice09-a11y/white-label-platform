import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HomologationRuntimeConfig } from "../../scripts/homologation/model.ts";
import { stableUuid } from "../../scripts/homologation/model.ts";
import { expectedAssets } from "../../scripts/homologation/plan.ts";
import type { Harness } from "./harness.ts";

export function homologationTestConfig(): HomologationRuntimeConfig {
  const resolvedAssets = Object.fromEntries(expectedAssets().map((asset, index) => [
    asset.key,
    { mime: "image/webp" as const, sizeBytes: 10_000 + index },
  ]));
  return {
    platformPlanSlug: "hml-platform-plan",
    planTemplateCode: "monthly_complete",
    tenantOwners: {
      aurora: stableUuid("auth:tenant-owner:aurora"),
      nexo: stableUuid("auth:tenant-owner:nexo"),
    },
    storeOwners: {
      lume: stableUuid("auth:store-owner:lume"),
      botanica: stableUuid("auth:store-owner:botanica"),
      passo: stableUuid("auth:store-owner:passo"),
      casa: stableUuid("auth:store-owner:casa"),
    },
    tenantLogoUrls: {
      aurora: "https://assets.example.test/aurora/logo.svg",
      nexo: "https://assets.example.test/nexo/logo.svg",
    },
    domains: {
      aurora: {
        tenantSite: "hml-aurora.example.test",
        tenantPanel: "app.hml-aurora.example.test",
        stores: {
          lume: { admin: "admin-lume.hml-aurora.example.test", catalog: "lume.hml-aurora.example.test" },
          botanica: { admin: "admin-botanica.hml-aurora.example.test", catalog: "botanica.hml-aurora.example.test" },
        },
      },
      nexo: {
        tenantSite: "hml-nexo.example.test",
        tenantPanel: "app.hml-nexo.example.test",
        stores: {
          passo: { admin: "admin-passo.hml-nexo.example.test", catalog: "passo.hml-nexo.example.test" },
          casa: { admin: "admin-casa.hml-nexo.example.test", catalog: "casa.hml-nexo.example.test" },
        },
      },
    },
    resolvedAssets,
    anchorIso: "2026-09-19T12:00:00.000Z",
  };
}

export async function prepareHomologationHarness(h: Harness, config: HomologationRuntimeConfig): Promise<void> {
  const migrationsDir = join(import.meta.dir, "..", "..", "supabase", "migrations");
  await h.db.execScript(readFileSync(join(migrationsDir, "0015_master_white_label_management.sql"), "utf8"));
  await h.db.execScript(readFileSync(join(migrationsDir, "0023_marketing_campaigns.sql"), "utf8"));
  await h.db.execScript("create table if not exists auth.users(id uuid primary key,email text unique);");
  const users = [...Object.entries(config.tenantOwners), ...Object.entries(config.storeOwners)];
  for (const [label, id] of users) {
    await h.db.query("insert into auth.users(id,email) values ($1::uuid,$2)", [id, `${label}@example.test`]);
  }
  await h.db.query(
    `insert into public.plans(slug,name,price_cents,active,billing_interval)
     values ($1,'Plano Kataluu HML',19900,true,'monthly')`,
    [config.platformPlanSlug],
  );
}