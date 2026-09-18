import { normalizeCouponCode, normalizeCouponInput } from "./coupons.ts";
import type {
  Coupon,
  CouponMutationInput,
  MarketingScope,
} from "./types.ts";
import type {
  CouponRepository,
  MarketingSqlExecutor,
} from "./repository.ts";

const COLUMNS =
  "id,tenant_id,store_id,code,name,active,discount_type,discount_value," +
  "minimum_order_cents,starts_at,ends_at,usage_limit,usage_count,created_at,updated_at";

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error("Campo inválido: " + key);
  return value;
}

function optional(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error("Campo inválido: " + key);
}

function mapCoupon(row: Record<string, unknown>): Coupon {
  return {
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    storeId: text(row, "store_id"),
    code: text(row, "code"),
    name: text(row, "name"),
    active: Boolean(row["active"]),
    discountType: text(row, "discount_type") as Coupon["discountType"],
    discountValue: Number(row["discount_value"]),
    minimumOrderCents: row["minimum_order_cents"] === null ? null : Number(row["minimum_order_cents"]),
    startsAt: optional(row, "starts_at"),
    endsAt: optional(row, "ends_at"),
    usageLimit: row["usage_limit"] === null ? null : Number(row["usage_limit"]),
    usageCount: Number(row["usage_count"]),
    createdAt: optional(row, "created_at") ?? "",
    updatedAt: optional(row, "updated_at") ?? "",
  };
}

function assertScope(scope: MarketingScope): void {
  if (!scope.tenantId || !scope.storeId) throw new Error("Escopo de marketing inválido");
}

async function list(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
): Promise<Coupon[]> {
  assertScope(scope);
  const rows = await sql.query(
    `select ${COLUMNS} from public.coupons
     where tenant_id=$1 and store_id=$2 order by created_at desc`,
    [scope.tenantId, scope.storeId],
  );
  return rows.map(mapCoupon);
}

async function getByCode(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  rawCode: string,
): Promise<Coupon | null> {
  assertScope(scope);
  const rows = await sql.query(
    `select ${COLUMNS} from public.coupons
     where tenant_id=$1 and store_id=$2 and code=$3 limit 1`,
    [scope.tenantId, scope.storeId, normalizeCouponCode(rawCode)],
  );
  return rows.length ? mapCoupon(rows[0]) : null;
}

function params(scope: MarketingScope, input: CouponMutationInput): unknown[] {
  return [
    scope.tenantId, scope.storeId, input.code, input.name, input.active,
    input.discountType, input.discountValue, input.minimumOrderCents,
    input.startsAt, input.endsAt, input.usageLimit,
  ];
}

async function create(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  raw: CouponMutationInput,
  actorUserId?: string | null,
): Promise<Coupon> {
  assertScope(scope);
  const input = normalizeCouponInput(raw);
  const rows = await sql.query(
    `with inserted as (
       insert into public.coupons (
         tenant_id,store_id,code,name,active,discount_type,discount_value,
         minimum_order_cents,starts_at,ends_at,usage_limit
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning ${COLUMNS}
     ), audit as (
       insert into public.audit_logs (
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select $12::uuid,$1::uuid,$2::uuid,'coupon.created','coupon',i.id::text,
         jsonb_build_object(
           'code',i.code,
           'discount_type',i.discount_type,
           'active',i.active
         )
       from inserted i
       where $12::uuid is not null
       returning id
     )
     select ${COLUMNS} from inserted`,
    [...params(scope, input), actorUserId ?? null],
  );
  if (rows.length === 0) throw new Error("Falha ao criar cupom");
  return mapCoupon(rows[0]);
}

async function update(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  id: string,
  raw: CouponMutationInput,
  actorUserId?: string | null,
): Promise<Coupon | null> {
  assertScope(scope);
  const input = normalizeCouponInput(raw);
  const values = params(scope, input);
  values.splice(2, 0, id);
  values.push(actorUserId ?? null);
  const rows = await sql.query(
    `with updated as (
       update public.coupons c set
         code=$4,name=$5,active=$6,discount_type=$7,discount_value=$8,
         minimum_order_cents=$9,starts_at=$10,ends_at=$11,usage_limit=$12,updated_at=now()
       from (
         select tenant_id,store_id,id,active as old_active
         from public.coupons
         where tenant_id=$1 and store_id=$2 and id=$3
       ) prior
       where c.tenant_id=prior.tenant_id
         and c.store_id=prior.store_id
         and c.id=prior.id
       returning c.id,c.tenant_id,c.store_id,c.code,c.name,c.active,c.discount_type,
         c.discount_value,c.minimum_order_cents,c.starts_at,c.ends_at,c.usage_limit,
         c.usage_count,c.created_at,c.updated_at,prior.old_active
     ), audit as (
       insert into public.audit_logs (
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select $13::uuid,$1::uuid,$2::uuid,
         case
           when u.old_active=false and u.active=true then 'coupon.activated'
           when u.old_active=true and u.active=false then 'coupon.deactivated'
           else 'coupon.updated'
         end,
         'coupon',u.id::text,
         jsonb_build_object(
           'code',u.code,
           'discount_type',u.discount_type,
           'active',u.active
         )
       from updated u
       where $13::uuid is not null
       returning id
     )
     select ${COLUMNS} from updated`,
    values,
  );
  return rows.length ? mapCoupon(rows[0]) : null;
}

export function createCouponRepository(sql: MarketingSqlExecutor): CouponRepository {
  return {
    list: (scope) => list(sql, scope),
    getByCode: (scope, code) => getByCode(sql, scope, code),
    create: (scope, input, actorUserId) => create(sql, scope, input, actorUserId),
    update: (scope, id, input, actorUserId) => update(sql, scope, id, input, actorUserId),
  };
}
