import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HomologationRuntimeConfig } from "../../scripts/homologation/model.ts";
import { stableUuid } from "../../scripts/homologation/model.ts";
import { expectedAssets } from "../../scripts/homologation/plan.ts";
import type { Harness } from "./harness.ts";

export function homologationTestConfig(): HomologationRuntimeConfig {
  const resolvedAssets = Object.fromEntries(expectedAssets().map((asset, index) => [
    asset.key,
    {
      source: `generated:test:${String(index)}`,
      mimeType: "image/webp" as const,
      sizeBytes: 10_000 + index,
      sha256: (index + 1).toString(16).padStart(64, "0"),
      storeKey: asset.storeKey,
      kind: asset.kind,
      productSlug: asset.productSlug,
    },
  ]));
  return {
    platformPlanSlug: "hml-platform-plan",
    platformBillingAmountCents: { aurora: 15_900, nexo: 18_900 },
    storePlans: {
      lume: { templateCode: "monthly_entry", slug: "plano-1-hml", name: "Plano 1 HML", priceCents: 4900, billingInterval: "monthly", trialEnabled: false, trialDays: 0 },
      botanica: { templateCode: "monthly_intermediate", slug: "plano-2-hml", name: "Plano 2 HML", priceCents: 7900, billingInterval: "monthly", trialEnabled: true, trialDays: 14 },
      passo: { templateCode: "monthly_complete", slug: "plano-3-hml", name: "Plano 3 HML", priceCents: 9900, billingInterval: "monthly", trialEnabled: false, trialDays: 0 },
      casa: { templateCode: "complete", slug: "completo-hml", name: "Completo HML", priceCents: 12_900, billingInterval: "monthly", trialEnabled: false, trialDays: 0 },
    },
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
    tenantOwnerEmails: {
      aurora: "hml.aurora@example.test",
      nexo: "hml.nexo@example.test",
    },
    storeOwnerEmails: {
      lume: "hml.lume@example.test",
      botanica: "hml.botanica@example.test",
      passo: "hml.passo@example.test",
      casa: "hml.casa@example.test",
    },
    tenantLogoUrls: {
      aurora: "https://assets.example.test/aurora/logo.webp",
      nexo: "https://assets.example.test/nexo/logo.webp",
    },
    domains: {
      aurora: {
        tenantSite: "hml-aurora.example.test",
        tenantPanel: "painel-aurora.example.test",
        stores: {
          lume: { admin: "gestao-lume.example.test", catalog: "lume.example.test" },
          botanica: { admin: "gestao-botanica.example.test", catalog: "botanica.example.test" },
        },
      },
      nexo: {
        tenantSite: "hml-nexo.example.test",
        tenantPanel: "painel-nexo.example.test",
        stores: {
          passo: { admin: "gestao-passo.example.test", catalog: "passo.example.test" },
          casa: { admin: "gestao-casa.example.test", catalog: "casa.example.test" },
        },
      },
    },
    mediaOrigin: "https://media.kataluu.com.br",
    resolvedAssets,
    anchorIso: "2026-09-19T12:00:00.000Z",
  };
}

export async function prepareHomologationHarness(h: Harness, config: HomologationRuntimeConfig): Promise<void> {
  const migrationsDir = join(import.meta.dir, "..", "..", "supabase", "migrations");
  await h.db.execScript(readFileSync(join(migrationsDir, "0015_master_white_label_management.sql"), "utf8"));
  await h.db.execScript(readFileSync(join(migrationsDir, "0023_marketing_campaigns.sql"), "utf8"));
  await h.db.execScript("create table if not exists auth.users(id uuid primary key,email text unique);");
  const users = [
    ...Object.entries(config.tenantOwners).map(([key, id]) => [id, config.tenantOwnerEmails[key as keyof typeof config.tenantOwnerEmails]] as const),
    ...Object.entries(config.storeOwners).map(([key, id]) => [id, config.storeOwnerEmails[key as keyof typeof config.storeOwnerEmails]] as const),
  ];
  for (const [id, email] of users) {
    await h.db.query("insert into auth.users(id,email) values ($1::uuid,$2)", [id, email]);
  }
  await h.db.query(
    `insert into public.plans(slug,name,price_cents,active,billing_interval)
     values ($1,'Plano Kataluu HML',19900,true,'monthly')`,
    [config.platformPlanSlug],
  );
}
