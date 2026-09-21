import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { readPublicStoreProfile } from "@white-label/catalog";
import type { CatalogScope, PublicStoreProfile } from "@white-label/catalog";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createRequestSupabaseClient } from "./supabase-server.server.ts";

const nullableText = (max: number) => z.string().trim().max(max).nullable();
const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: nullableText(1000),
  phone: nullableText(30),
  publicEmail: z.string().trim().email().max(254).nullable(),
  address: nullableText(500),
  instagram: z.string().trim().regex(/^@?[A-Za-z0-9._]{1,30}$/).nullable(),
});

type Sql = ReturnType<typeof createAdminSqlExecutor>;
type ProfileInput = z.infer<typeof profileSchema>;

function valueText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function valueInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function loadStoreSettings(sql: Sql, scope: CatalogScope): Promise<PublicStoreProfile> {
  const rows = await sql.query(
    `select settings from public.store_settings where tenant_id=$1::uuid and store_id=$2::uuid limit 1`,
    [scope.tenantId, scope.storeId],
  );
  return readPublicStoreProfile(rows[0]?.["settings"]);
}

async function loadPlan(sql: Sql, scope: CatalogScope) {
  const rows = await sql.query(
    `select p.name,p.description,p.price_cents,p.billing_interval,s.status,s.trial_ends_at,s.current_period_ends_at
     from public.store_subscriptions s
     join public.tenant_plans p on p.tenant_id=s.tenant_id and p.id=s.tenant_plan_id
     where s.tenant_id=$1::uuid and s.store_id=$2::uuid
     order by case s.status when 'trialing' then 0 when 'active' then 1 when 'past_due' then 2 when 'suspended' then 3 else 4 end,
              s.created_at desc
     limit 1`,
    [scope.tenantId, scope.storeId],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const name = valueText(row["name"]);
  const status = valueText(row["status"]);
  const billingInterval = valueText(row["billing_interval"]);
  if (!name || !status || !billingInterval) throw new Error("Plano atual inválido");
  return {
    name,
    description: valueText(row["description"]),
    priceCents: valueInteger(row["price_cents"]),
    billingInterval,
    status,
    trialEndsAt: valueText(row["trial_ends_at"]),
    currentPeriodEndsAt: valueText(row["current_period_ends_at"]),
  };
}

async function loadAccount(userId: string) {
  const client = createRequestSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || data.user.id !== userId) throw new Error("Conta autenticada não encontrada");
  return {
    email: data.user.email ?? null,
    phone: data.user.phone ?? null,
    createdAt: data.user.created_at,
  };
}

async function auditProfileUpdate(sql: Sql, scope: CatalogScope, userId: string): Promise<void> {
  await sql.query(
    `insert into public.audit_logs (actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
     values ($1::uuid,$2::uuid,$3::uuid,'store.settings.updated','store',$3::text,$4::jsonb) returning id`,
    [userId, scope.tenantId, scope.storeId, JSON.stringify({ fields: ["name", "description", "phone", "public_email", "address", "instagram"] })],
  );
}

function profilePatch(data: ProfileInput): Record<string, string | null> {
  return {
    description: data.description,
    phone: data.phone,
    public_email: data.publicEmail,
    address: data.address,
    instagram: data.instagram?.replace(/^@/, "") ?? null,
  };
}

export const getMerchantSettingsOverview = createServerFn({ method: "GET" }).handler(async () => {
  const context = await createMerchantCatalogContext(getRequestHost());
  if (!context.userId) throw new Error("Usuário autenticado não resolvido");
  const sql = createAdminSqlExecutor();
  const [profile, plan, account, catalog] = await Promise.all([
    loadStoreSettings(sql, context.scope),
    loadPlan(sql, context.scope),
    loadAccount(context.userId),
    context.repository.getSettings(context.scope),
  ]);
  return {
    store: {
      name: context.store.name,
      slug: context.store.slug,
      status: context.store.storeStatus,
      profile,
    },
    catalog: {
      whatsappPhone: catalog.whatsappPhone,
      seoTitle: catalog.seoTitle,
      seoDescription: catalog.seoDescription,
    },
    plan,
    account,
  };
});

export const saveMerchantStoreProfile = createServerFn({ method: "POST" })
  .validator(profileSchema)
  .handler(async ({ data }) => {
    const context = await createMerchantCatalogContext(getRequestHost());
    if (!context.userId) throw new Error("Usuário autenticado não resolvido");
    const sql = createAdminSqlExecutor();
    const patch = profilePatch(data);
    const rows = await sql.query(
      `with updated_store as (
         update public.stores set name=$3,updated_at=now()
         where tenant_id=$1::uuid and id=$2::uuid
         returning id
       ), upserted_settings as (
         insert into public.store_settings (tenant_id,store_id,settings,updated_at)
         select $1::uuid,$2::uuid,$4::jsonb,now() from updated_store
         on conflict (store_id) do update set
           settings=coalesce(store_settings.settings,'{}'::jsonb) || excluded.settings,
           updated_at=now()
         where store_settings.tenant_id=excluded.tenant_id
         returning settings
       )
       select settings from upserted_settings`,
      [context.scope.tenantId, context.scope.storeId, data.name, JSON.stringify(patch)],
    );
    if (rows.length === 0) throw new Error("Loja não encontrada no escopo autenticado");
    await auditProfileUpdate(sql, context.scope, context.userId);
    return { name: data.name, profile: readPublicStoreProfile(rows[0]["settings"]) };
  });
