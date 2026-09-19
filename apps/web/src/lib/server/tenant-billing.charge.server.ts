import { createHash } from "node:crypto";
import type {
  GatewayAccountId,
  PaymentProviderName,
  PaymentStatus,
} from "@white-label/payments";
import type { ControlSql } from "./control-merchants.shared.server.ts";
import type { TenantProviderLoader } from "./tenant-billing.provider.server.ts";

interface ChargeTarget {
  subscriptionId: string;
  tenantId: string;
  storeId: string;
  status: string;
  planName: string;
  priceCents: number;
  billingInterval: "monthly" | "quarterly" | "yearly";
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
}

export interface TenantChargeResult {
  paymentId: string;
  status: PaymentStatus;
  provider: PaymentProviderName;
  providerPaymentId: string | null;
  created: boolean;
}

export async function createTenantMerchantCharge(
  sql: ControlSql,
  actorUserId: string,
  tenantId: string,
  storeId: string,
  subscriptionId: string,
  providers: TenantProviderLoader,
  now = new Date(),
): Promise<TenantChargeResult> {
  const target = await loadChargeTarget(sql, tenantId, storeId, subscriptionId);
  assertChargeReady(target, now);
  const key = chargeKey(target);
  const reserved = await reservePayment(sql, target, key);
  if (reserved.providerPaymentId) return existingResult(reserved, target.provider);
  const claimed = await claimProviderCreate(sql, reserved.id);
  if (!claimed) return existingResult(reserved, target.provider);
  try {
    const provider = await providers.load({
      id: target.gatewayId,
      provider: target.provider,
      tenantId: target.tenantId,
    });
    const created = await provider.createIntent({
      level: "tenant_billing",
      tenantId: target.tenantId,
      storeId: target.storeId,
      gatewayAccountId: target.gatewayId as GatewayAccountId,
      amountCents: target.priceCents,
      idempotencyKey: key,
      description: `${target.planName} - ${target.storeId}`,
      externalReference: `tenant-subscription:${target.subscriptionId}`,
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
  if (target.status === "canceled" || target.status === "expired" || target.status === "suspended") {
    throw new Error("Assinatura indisponível para cobrança.");
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
    throw new Error("Lojista sem e-mail para cobrança Mercado Pago.");
  }
  if (target.provider === "asaas") {
    throw new Error("Asaas tenant_billing requer customer mapping server-side ainda não definido.");
  }
}

function chargeKey(target: ChargeTarget): string {
  const anchor = target.currentPeriodEndsAt ?? target.trialEndsAt ?? target.startedAt;
  const raw = `${target.tenantId}:${target.storeId}:${target.subscriptionId}:${anchor}:${String(target.priceCents)}:${target.billingInterval}`;
  return `tb-${createHash("sha256").update(raw).digest("hex").slice(0, 48)}`;
}

async function loadChargeTarget(
  sql: ControlSql,
  tenantId: string,
  storeId: string,
  subscriptionId: string,
): Promise<ChargeTarget> {
  const rows = await sql.query(CHARGE_TARGET_SQL, [tenantId, storeId, subscriptionId]);
  const row = rows.at(0);
  if (!row) throw new Error("Assinatura tenant_billing inválida, fora do tenant/store ou plano incompleto.");
  const gateways = await sql.query(
    `select id::text,provider from public.gateway_accounts
     where level='tenant_billing' and tenant_id=$1::uuid and store_id is null and status='active'
     order by created_at,id`,
    [tenantId],
  );
  if (gateways.length !== 1) {
    throw new Error("É necessária exatamente uma gateway tenant_billing ativa da White Label.");
  }
  return mapChargeTarget(row, gateways[0] ?? {});
}

function mapChargeTarget(row: Record<string, unknown>, gateway: Record<string, unknown>): ChargeTarget {
  return {
    subscriptionId: requiredText(row, "subscription_id"),
    tenantId: requiredText(row, "tenant_id"),
    storeId: requiredText(row, "store_id"),
    status: requiredText(row, "status"),
    planName: requiredText(row, "plan_name"),
    priceCents: safeInteger(row, "price_cents"),
    billingInterval: requiredText(row, "billing_interval") as ChargeTarget["billingInterval"],
    startedAt: requiredText(row, "started_at"),
    trialEndsAt: nullableText(row, "trial_ends_at"),
    currentPeriodEndsAt: nullableText(row, "current_period_ends_at"),
    ownerEmail: nullableText(row, "owner_email"),
    gatewayId: requiredText(gateway, "id"),
    provider: requiredText(gateway, "provider") as PaymentProviderName,
  };
}

async function reservePayment(
  sql: ControlSql,
  target: ChargeTarget,
  idempotencyKey: string,
): Promise<ReservedPayment> {
  const inserted = await sql.query(
    `insert into public.payments(
       level,tenant_id,store_id,gateway_account_id,amount_cents,currency,status,
       store_subscription_id,idempotency_key
     ) values ('tenant_billing',$1::uuid,$2::uuid,$3::uuid,$4,'BRL','pending',$5::uuid,$6)
     on conflict do nothing
     returning id::text,status,provider_payment_id`,
    [
      target.tenantId,
      target.storeId,
      target.gatewayId,
      target.priceCents,
      target.subscriptionId,
      idempotencyKey,
    ],
  );
  if (inserted[0]) return mapReserved(inserted[0]);
  const existing = await sql.query(
    `select id::text,status,provider_payment_id from public.payments
     where level='tenant_billing' and tenant_id=$1::uuid and store_id=$2::uuid
       and idempotency_key=$3 limit 1`,
    [target.tenantId, target.storeId, idempotencyKey],
  );
  if (!existing[0]) throw new Error("Falha ao resolver cobrança tenant_billing idempotente.");
  return mapReserved(existing[0]);
}

async function claimProviderCreate(sql: ControlSql, paymentId: string): Promise<boolean> {
  const rows = await sql.query(
    `update public.payments
     set provider_create_started_at=now(),updated_at=now()
     where id=$1::uuid and level='tenant_billing' and provider_payment_id is null
       and (
         provider_create_started_at is null
         or provider_create_started_at < now()-interval '5 minutes'
       )
     returning id::text`,
    [paymentId],
  );
  return Boolean(rows.at(0));
}

async function releaseProviderCreate(sql: ControlSql, paymentId: string): Promise<void> {
  await sql.query(
    `update public.payments set provider_create_started_at=null,updated_at=now()
     where id=$1::uuid and level='tenant_billing' and provider_payment_id is null`,
    [paymentId],
  );
}

async function finalizePayment(
  sql: ControlSql,
  actorUserId: string,
  paymentId: string,
  providerPaymentId: string,
): Promise<void> {
  const rows = await sql.query(
    `with changed as (
       update public.payments
       set provider_payment_id=$2,provider_create_started_at=null,updated_at=now()
       where id=$1::uuid and level='tenant_billing' and provider_payment_id is null
       returning id,tenant_id,store_id,amount_cents
     ), audit as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $3::uuid,tenant_id,store_id,'tenant_billing.charge_created','payment',id::text,
         jsonb_build_object('amount_cents',amount_cents,'level','tenant_billing')
       from changed returning id
     )
     select id::text from changed`,
    [paymentId, providerPaymentId, actorUserId],
  );
  if (!rows.at(0)) throw new Error("Cobrança tenant_billing não pôde ser vinculada ao provider.");
}

function mapReserved(row: Record<string, unknown>): ReservedPayment {
  return {
    id: requiredText(row, "id"),
    status: requiredText(row, "status") as PaymentStatus,
    providerPaymentId: nullableText(row, "provider_payment_id"),
  };
}

function existingResult(payment: ReservedPayment, provider: PaymentProviderName): TenantChargeResult {
  return {
    paymentId: payment.id,
    status: payment.status,
    provider,
    providerPaymentId: payment.providerPaymentId,
    created: false,
  };
}

function requiredText(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Campo inválido: ${key}`);
  return value;
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function safeInteger(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key]);
  if (!Number.isSafeInteger(value)) throw new Error(`Número inválido: ${key}`);
  return value;
}

const CHARGE_TARGET_SQL = `select s.id::text as subscription_id,s.tenant_id::text,s.store_id::text,
  s.status,s.started_at::text,s.trial_ends_at::text,s.current_period_ends_at::text,
  p.name as plan_name,p.price_cents,p.billing_interval,owner.email as owner_email
from public.store_subscriptions s
join public.tenant_plans p
  on p.tenant_id=s.tenant_id and p.id=s.tenant_plan_id and p.active=true
left join lateral (
  select u.email from public.store_members sm
  join auth.users u on u.id=sm.user_id
  where sm.tenant_id=s.tenant_id and sm.store_id=s.store_id and sm.role='store_owner'
  order by sm.created_at limit 1
) owner on true
where s.tenant_id=$1::uuid and s.store_id=$2::uuid and s.id=$3::uuid
  and s.level='tenant_billing'`;
