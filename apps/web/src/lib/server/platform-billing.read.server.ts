import type { AdminSql } from "./master-white-label.shared.server.ts";
import type {
  BillingInterval,
  PlatformBillingSnapshot,
  PlatformPlanView,
  PlatformSubscriptionStatus,
} from "./platform-billing.types.ts";
import type { PaymentProviderName, PaymentStatus } from "@white-label/payments";

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Campo inválido: ${key}`);
  return value;
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function nullableNumber(row: Row, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Número inválido: ${key}`);
  return parsed;
}

export async function listPlatformPlans(sql: AdminSql): Promise<PlatformPlanView[]> {
  const rows = await sql.query(
    `select id::text,slug,name,price_cents,active,billing_interval
     from public.plans order by price_cents,name`,
    [],
  );
  return rows.map((row) => ({
    id: text(row, "id"),
    slug: text(row, "slug"),
    name: text(row, "name"),
    priceCents: nullableNumber(row, "price_cents") ?? 0,
    active: row["active"] === true,
    billingInterval: nullableText(row, "billing_interval") as BillingInterval | null,
  }));
}

export async function getPlatformBillingSnapshot(
  sql: AdminSql,
  tenantId: string,
): Promise<PlatformBillingSnapshot | null> {
  const rows = await sql.query(
    `select t.id::text as tenant_id,t.name as tenant_name,t.status as tenant_status,
       t.trial_ends_at::text as tenant_trial_ends_at,
       s.id::text as subscription_id,s.status as subscription_status,
       s.trial_started_at::text,s.trial_ends_at::text,
       s.current_period_started_at::text,s.current_period_ends_at::text,
       s.canceled_at::text,p.id::text as plan_id,p.name as plan_name,
       p.price_cents,p.billing_interval,
       pay.status as payment_status,pay.amount_cents as payment_amount_cents,
       pay.created_at::text as payment_created_at,ga.provider
     from public.tenants t
     left join lateral (
       select * from public.subscriptions
       where tenant_id=t.id and level='platform_billing'
       order by (status in ('trialing','active','past_due')) desc,created_at desc
       limit 1
     ) s on true
     left join public.plans p on p.id=s.plan_id
     left join lateral (
       select * from public.payments
       where tenant_id=t.id and level='platform_billing'
         and (s.id is null or subscription_id=s.id)
       order by created_at desc limit 1
     ) pay on true
     left join public.gateway_accounts ga on ga.id=pay.gateway_account_id
     where t.id=$1::uuid`,
    [tenantId],
  );
  const row = rows.at(0);
  return row ? mapSnapshot(row) : null;
}

function mapSnapshot(row: Row): PlatformBillingSnapshot {
  return {
    tenantId: text(row, "tenant_id"),
    tenantName: text(row, "tenant_name"),
    tenantStatus: text(row, "tenant_status"),
    tenantTrialEndsAt: nullableText(row, "tenant_trial_ends_at"),
    subscriptionId: nullableText(row, "subscription_id"),
    subscriptionStatus: nullableText(row, "subscription_status") as PlatformSubscriptionStatus | null,
    planId: nullableText(row, "plan_id"),
    planName: nullableText(row, "plan_name"),
    priceCents: nullableNumber(row, "price_cents"),
    billingInterval: nullableText(row, "billing_interval") as BillingInterval | null,
    trialStartedAt: nullableText(row, "trial_started_at"),
    trialEndsAt: nullableText(row, "trial_ends_at"),
    currentPeriodStartedAt: nullableText(row, "current_period_started_at"),
    currentPeriodEndsAt: nullableText(row, "current_period_ends_at"),
    canceledAt: nullableText(row, "canceled_at"),
    provider: nullableText(row, "provider") as PaymentProviderName | null,
    paymentStatus: nullableText(row, "payment_status") as PaymentStatus | null,
    paymentAmountCents: nullableNumber(row, "payment_amount_cents"),
    paymentCreatedAt: nullableText(row, "payment_created_at"),
  };
}
