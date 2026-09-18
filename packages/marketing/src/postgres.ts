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
): Promise<Coupon> {
  assertScope(scope);
  const input = normalizeCouponInput(raw);
  const rows = await sql.query(
    `insert into public.coupons (
       tenant_id,store_id,code,name,active,discount_type,discount_value,
       minimum_order_cents,starts_at,ends_at,usage_limit
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     returning ${COLUMNS}`,
    params(scope, input),
  );
  if (rows.length === 0) throw new Error("Falha ao criar cupom");
  return mapCoupon(rows[0]);
}

async function update(
  sql: MarketingSqlExecutor,
  scope: MarketingScope,
  id: string,
  raw: CouponMutationInput,
): Promise<Coupon | null> {
  assertScope(scope);
  const input = normalizeCouponInput(raw);
  const values = params(scope, input);
  values.splice(2, 0, id);
  const rows = await sql.query(
    `update public.coupons set
       code=$4,name=$5,active=$6,discount_type=$7,discount_value=$8,
       minimum_order_cents=$9,starts_at=$10,ends_at=$11,usage_limit=$12,updated_at=now()
     where tenant_id=$1 and store_id=$2 and id=$3
     returning ${COLUMNS}`,
    values,
  );
  return rows.length ? mapCoupon(rows[0]) : null;
}

export function createCouponRepository(sql: MarketingSqlExecutor): CouponRepository {
  return {
    list: (scope) => list(sql, scope),
    getByCode: (scope, code) => getByCode(sql, scope, code),
    create: (scope, input) => create(sql, scope, input),
    update: (scope, id, input) => update(sql, scope, id, input),
  };
}
