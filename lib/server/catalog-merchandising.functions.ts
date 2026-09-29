import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  CATALOG_MERCHANDISING_LABEL_KEYS,
  isSafePromotionalHref,
  mergeCatalogMerchandisingLabels,
  readCatalogMerchandising,
} from "@white-label/catalog";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";

const merchandisingSchema = z.object({
  enabled: z.boolean(),
  text: z.string().trim().max(120),
  href: z.string().trim().max(120).refine(isSafePromotionalHref, "Link promocional inválido").nullable(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  countdown: z.boolean(),
}).superRefine((data, context) => {
  if (data.enabled && !data.text) {
    context.addIssue({ code: "custom", path: ["text"], message: "Informe o texto promocional" });
  }
  if (data.countdown && !data.endsAt) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "Countdown exige data final" });
  }
  if (data.startsAt && data.endsAt && Date.parse(data.startsAt) >= Date.parse(data.endsAt)) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "O fim deve ser posterior ao início" });
  }
});

async function merchandisingContext() {
  const context = await createMerchantCatalogContext(getRequestHost());
  const sql = createAdminSqlExecutor();
  return { context, sql };
}

export const getMerchantCatalogMerchandising = createServerFn({ method: "GET" }).handler(async () => {
  const { context } = await merchandisingContext();
  const settings = await context.repository.getSettings(context.scope);
  return readCatalogMerchandising(settings.labels);
});

export const saveMerchantCatalogMerchandising = createServerFn({ method: "POST" })
  .validator(merchandisingSchema)
  .handler(async ({ data }) => {
    const { context, sql } = await merchandisingContext();
    const patch = mergeCatalogMerchandisingLabels({}, data);
    const rows = await sql.query(
      `insert into public.catalog_settings (tenant_id,store_id,labels)
       values ($1::uuid,$2::uuid,$3::jsonb)
       on conflict (store_id) do update set
         labels=(coalesce(catalog_settings.labels,'{}'::jsonb)
           - 'promo.enabled' - 'promo.text' - 'promo.href'
           - 'promo.startsAt' - 'promo.endsAt' - 'promo.countdown') || excluded.labels,
         updated_at=now()
       where catalog_settings.tenant_id=excluded.tenant_id
       returning labels`,
      [context.scope.tenantId, context.scope.storeId, JSON.stringify(patch)],
    );
    if (!rows.length) throw new Error("Configuração promocional não encontrada para esta loja");
    await sql.query(
      `insert into public.audit_logs
        (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       values ($1::uuid,$2::uuid,$3::uuid,'storefront.merchandising.updated','catalog_settings',$3::text,$4::jsonb)
       returning id`,
      [context.userId, context.scope.tenantId, context.scope.storeId, JSON.stringify({ fields: CATALOG_MERCHANDISING_LABEL_KEYS })],
    );
    return readCatalogMerchandising(rows[0]["labels"]);
  });
