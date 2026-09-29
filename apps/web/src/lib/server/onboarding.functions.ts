import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { readPublicStoreProfile } from "@white-label/catalog";
import { deriveOnboardingSteps, onboardingProgress } from "../onboarding-progress.ts";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";

function integer(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

export const getMerchantOnboarding = createServerFn({ method: "GET" }).handler(async () => {
  const context = await createMerchantCatalogContext(getRequestHost());
  const sql = createAdminSqlExecutor();
  const rows = await sql.query(
    `select
       ss.settings as store_settings,
       exists(select 1 from public.catalog_settings cs where cs.tenant_id=$1::uuid and cs.store_id=$2::uuid) as has_catalog_settings,
       (select count(*)::integer from public.categories c where c.tenant_id=$1::uuid and c.store_id=$2::uuid) as category_count,
       (select count(*)::integer from public.products p where p.tenant_id=$1::uuid and p.store_id=$2::uuid) as product_count,
       exists(
         select 1 from public.domains d
         where d.tenant_id=$1::uuid and d.store_id=$2::uuid and d.type='store_catalog'
           and d.status='active' and d.verified_at is not null
       ) as has_public_domain
     from public.stores s
     left join public.store_settings ss on ss.tenant_id=s.tenant_id and ss.store_id=s.id
     where s.tenant_id=$1::uuid and s.id=$2::uuid
     limit 1`,
    [context.scope.tenantId, context.scope.storeId],
  );
  if (rows.length === 0) throw new Error("Loja não encontrada no escopo autenticado");
  const row = rows[0];
  const profile = readPublicStoreProfile(row["store_settings"]);
  const facts = {
    hasBasicStore: context.store.name.trim().length > 0,
    hasContact: Boolean(profile.phone || profile.publicEmail || profile.address || profile.instagram),
    hasAppearance: Boolean(row["has_catalog_settings"]),
    hasCatalogSettings: Boolean(row["has_catalog_settings"]),
    categoryCount: integer(row["category_count"]),
    productCount: integer(row["product_count"]),
    hasPublicDomain: Boolean(row["has_public_domain"]),
    storeActive: context.store.storeStatus === "active",
  };
  const steps = deriveOnboardingSteps(facts);
  return { facts, steps, progress: onboardingProgress(steps) };
});
