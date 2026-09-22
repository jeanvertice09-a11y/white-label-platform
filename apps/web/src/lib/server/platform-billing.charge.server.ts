import { createHash } from "node:crypto";
import type {
  GatewayAccountId,
  PaymentProviderName,
  PaymentStatus,
} from "@white-label/payments";
import type { AdminSql } from "./master-white-label.shared.server.ts";
import type { PlatformProviderLoader } from "./platform-billing.provider.server.ts";
import type {
  BillingInterval,
  PlatformChargeResult,
  PlatformSubscriptionStatus,
} from "./platform-billing.types.ts";

type Row = Record<string, unknown>;

interface ChargeTarget {
  subscriptionId: string;
  tenantId: string;
  status: PlatformSubscriptionStatus;
  planName: string;
  priceCents: number;
  billingInterval: BillingInterval;
  startedAt: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  ownerEmail: string | null;
  gatewayId: string;
  provider: PaymentProviderName;
}

interface ReservedPayment {
  id: string;
  status: PaymentStatus;
  providerPaymentId: string | null;
  gatewayAccountId: string;
}

export async function createPlatformCharge(
  sql: AdminSql,
  actorUserId: string,
  subscriptionId: string,
  providers: PlatformProviderLoader,
  now = new Date(),
): Promise<PlatformChargeResult> {
  const target = await loadChargeTarget(sql, subscriptionId);
  assertChargeReady(target, now);
  const key = chargeKey(target);
  const reserved = await reservePayment(sql, target, key);
  if (reserved.providerPaymentId) return existingResult(reserved, target.provider);
  const claimed = await claimProviderCreate(sql, reserved.id);
  if (!claimed) return existingResult(reserved, target.provider);
  try {
    const provider = await providers.load({ id: target.gatewayId, provider: target.provider });
    const created = await provider.createIntent({
      level: "platform_billing",
      tenantId: target.tenantId,
      storeId: null,
      gatewayAccountId: target.gatewayId as GatewayAccountId,
      amountCents: target.priceCents,
      idempotencyKey: key,
      description: `Kataluu - ${target.planName}`,
      externalReference: `platform-subscription:${target.subscriptionId}`,
      payerEmail: target.ownerEmail ?? undefined,
      paymentMethod: "pix",
    });
    await finalizePayment(sql, actorUserId, reserved.id, created.providerPaymentId);
    return {
      paymentId: reserved.id,
      status: "pending",
      provider: target.provider,
      providerPaymentId: created.providerPaymentId,
      created: true,
    };
  } catch (error) {
    await releaseProviderCreate(sql, reserved.id);
    throw error;
  }
}

function assertChargeReady(target: ChargeTarget, now: Date): void {
  if (target.status === "canceled" || target.status === "expired") {
    throw new Error("Assinatura encerrada não aceita nova cobrança.");
  }
  if (
    target.status === "trialing"
    && target.trialEndsAt
    && Date.parse(target.trialEndsAt) > now.getTime()
  ) {
    throw new Error("Trial válido não requer pagamento.");
  }
  if (
    target.status === "active"
    && target.currentPeriodEndsAt
    && Date.parse(target.currentPeriodEndsAt) > now.getTime()
  ) {
    throw new Error("Renovação ainda não está vencida.");
  }
  if (target.priceCents <= 0) {
    throw new Error("Plano sem valor cobrável; regra gratuita não está definida.");
  }
  if (target.provider === "mercadopago" && !target.ownerEmail) {
    throw new Error("Owner sem e-mail para cobrança Mercado Pago.");
  }
  if (target.provider === "asaas") {
    throw new Error("Asaas platform_billing requer customer mapping server-side ainda não definido.");
  }
}

function chargeKey(target: ChargeTarget): string {
  const anchor = target.currentPeriodEndsAt ?? target.trialEndsAt ?? target.startedAt;
  const raw = `${target.subscriptionId}:${anchor}:${String(target.priceCents)}:${target.billingInterval}`;
  return `pb-${createHash("sha256").update(raw).digest("hex").slice(0, 48)}`;
}

async function loadChargeTarget(
  sql: AdminSql,
  subscriptionId: string,
): Promise<ChargeTarget> {
  const rows = await sql.query(CHARGE_TARGET_SQL, [subscriptionId]);
  const row = rows.at(0);
  if (!row) throw new Error("Assinatura platform_billing inválida ou plano incompleto.");
  const gateways = await sql.query(
    `select id::text,provider from public.gateway_accounts
     where level='platform_billing' and tenant_id is null and store_id is null and status='active'
     order by created_at,id`,
    [],
  );
  if (gateways.length !== 1) {
    throw new Error("É necessária exatamente uma gateway platform_billing ativa.");
  }
  return mapChargeTarget(row, gateways[0] ?? {});
}

function mapChargeTarget(row: Row, gateway: Row): ChargeTarget {
  return {
    subscriptionId: requiredText(row, "subscription_id"),
    tenantId: requiredText(row, "tenant_id"),
    status: requiredText(row, "status") as PlatformSubscriptionStatus,
    planName: requiredText(row, "plan_name"),
    priceCents: safeInteger(row, "price_cents"),
    billingInterval: requiredText(row, "billing_interval") as BillingInterval,
    startedAt: requiredText(row, "started_at"),
    trialEndsAt: nullableText(row, "trial_ends_at"),
    currentPeriodEndsAt: nullableText(row, "current_period_ends_at"),
    ownerEmail: nullableText(row, "owner_email"),
    gatewayId: requiredText(gateway, "id"),
    provider: requiredText(gateway, "provider") as PaymentProviderName,
  };
}

async function reservePayment(
  sql: AdminSql,
  target: ChargeTarget,
  idempotencyKey: string,
): Promise<ReservedPayment> {
  const inserted = await sql.query(
    `insert into public.payments(
       level,tenant_id,store_id,gateway_account_id,amount_cents,currency,status,
       subscription_id,idempotency_key
     ) values ('platform_billing',$1::uuid,null,$2::uuid,$3,'BRL','pending',$4::uuid,$5)
     on conflict do nothing
     returning id::text,status,provider_payment_id,gateway_account_id::text`,
    [target.tenantId, target.gatewayId, target.priceCents, target.subscriptionId, idempotencyKey],
  );
  if (inserted[0]) return mapReserved(inserted[0]);
  const existing = await sql.query(
    `select id::text,status,provider_payment_id,gateway_account_id::text from public.payments
     where level='platform_billing' and tenant_id=$1::uuid and idempotency_key=$2 limit 1`,
    [target.tenantId, idempotencyKey],
  );
  if (!existing[0]) throw new Error("Falha ao resolver cobrança idempotente.");
  const reserved = mapReserved(existing[0]);
  if (reserved.gatewayAccountId !== target.gatewayId) {
    throw new Error("Cobrança idempotente pertence a outro gateway; troca de gateway requer novo ciclo.");
  }
  return reserved;
}

async function claimProviderCreate(sql: AdminSql, paymentId: string): Promise<boolean> {
  const rows = await sql.query(
    `update public.payments
     set provider_create_started_at=now(),updated_at=now()
     where id=$1::uuid and level='platform_billing' and provider_payment_id is null
       and (
         provider_create_started_at is null
         or provider_create_started_at < now()-interval '5 minutes'
       )
     returning id::text`,
    [paymentId],
  );
  return Boolean(rows.at(0));
}

async function releaseProviderCreate(sql: AdminSql, paymentId: string): Promise<void> {
  await sql.query(
    `update public.payments set provider_create_started_at=null,updated_at=now()
     where id=$1::uuid and level='platform_billing' and provider_payment_id is null`,
    [paymentId],
  );
}

function mapReserved(row: Row): ReservedPayment {
  return {
    id: requiredText(row, "id"),
    status: requiredText(row, "status") as PaymentStatus,
    providerPaymentId: nullableText(row, "provider_payment_id"),
    gatewayAccountId: requiredText(row, "gateway_account_id"),
  };
}

function existingResult(
  payment: ReservedPayment,
  provider: PaymentProviderName,
): PlatformChargeResult {
  return {
    paymentId: payment.id,
    status: payment.status,
    provider,
    providerPaymentId: payment.providerPaymentId,
    created: false,
  };
}

async function finalizePayment(
  sql: AdminSql,
  actorUserId: string,
  paymentId: string,
  providerPaymentId: string,
): Promise<void> {
  const rows = await sql.query(
    `with changed as (
       update public.payments
       set provider_payment_id=$2,provider_create_started_at=null,updated_at=now()
       where id=$1::uuid and level='platform_billing' and provider_payment_id is null
       returning id,tenant_id,amount_cents
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,action,resource_type,resource_id,metadata)
       select $3::uuid,tenant_id,'billing.charge_created','payment',id::text,
         jsonb_build_object('amount_cents',amount_cents,'level','platform_billing')
       from changed returning id
     )
     select id::text from changed`,
    [paymentId, providerPaymentId, actorUserId],
  );
  if (!rows.at(0)) throw new Error("Cobrança não pôde ser vinculada ao provider.");
}

function requiredText(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Campo inválido: ${key}`);
  return value;
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function safeInteger(row: Row, key: string): number {
  const value = Number(row[key]);
  if (!Number.isSafeInteger(value)) throw new Error(`Número inválido: ${key}`);
  return value;
}

const CHARGE_TARGET_SQL = `select s.id::text as subscription_id,s.tenant_id::text,
  s.status,s.started_at::text,s.trial_ends_at::text,s.current_period_ends_at::text,
  p.name as plan_name,p.price_cents,p.billing_interval,owner.email as owner_email
from public.subscriptions s
join public.plans p on p.id=s.plan_id and p.active=true and p.billing_interval is not null
left join lateral (
  select u.email from public.tenant_members tm
  join auth.users u on u.id=tm.user_id
  where tm.tenant_id=s.tenant_id and tm.role='tenant_owner'
  order by tm.created_at limit 1
) owner on true
where s.id=$1::uuid and s.level='platform_billing'`;
