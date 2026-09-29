import type {
  PlanEntitlementValue,
  PlanTemplateView,
  TenantPlanEntitlementInput,
} from "./commercial-types.ts";
import type { BillingSqlExecutor } from "./postgres-entitlements.ts";

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Campo inválido: ${key}`);
  return value;
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`Campo inválido: ${key}`);
  return value;
}

function numberValue(row: Row, key: string): number {
  const value = Number(row[key]);
  if (!Number.isSafeInteger(value)) throw new Error(`Número inválido: ${key}`);
  return value;
}

function boolValue(row: Row, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw new Error(`Boolean inválido: ${key}`);
  return value;
}

function entitlement(row: Row): PlanEntitlementValue {
  return {
    key: text(row, "entitlement_key"),
    kind: text(row, "kind") as PlanEntitlementValue["kind"],
    name: text(row, "entitlement_name"),
    unit: nullableText(row, "unit"),
    enabled: row["enabled"] === null ? null : boolValue(row, "enabled"),
    limitValue: row["limit_value"] === null ? null : numberValue(row, "limit_value"),
  };
}

export async function listPlatformPlanTemplates(
  sql: BillingSqlExecutor,
): Promise<PlanTemplateView[]> {
  const [templates, values] = await Promise.all([
    sql.query(
      `select id,code,name,description,active,sort_order
       from public.plan_templates order by sort_order,name`,
      [],
    ),
    sql.query(
      `select te.template_id,d.key as entitlement_key,d.kind,d.name as entitlement_name,d.unit,
         te.enabled,te.limit_value
       from public.plan_template_entitlements te
       join public.entitlement_definitions d on d.key=te.entitlement_key
       order by te.template_id,d.kind,d.key`,
      [],
    ),
  ]);
  const byTemplate = new Map<string, PlanEntitlementValue[]>();
  for (const row of values) {
    const templateId = text(row, "template_id");
    const list = byTemplate.get(templateId) ?? [];
    list.push(entitlement(row));
    byTemplate.set(templateId, list);
  }
  return templates.map((row) => ({
    id: text(row, "id"),
    code: text(row, "code"),
    name: text(row, "name"),
    description: nullableText(row, "description"),
    active: boolValue(row, "active"),
    sortOrder: numberValue(row, "sort_order"),
    entitlements: byTemplate.get(text(row, "id")) ?? [],
  }));
}

function payload(values: TenantPlanEntitlementInput[]): string {
  const seen = new Set<string>();
  return JSON.stringify(values.map((value) => {
    if (seen.has(value.key)) throw new Error(`Entitlement duplicado: ${value.key}`);
    seen.add(value.key);
    if (value.kind === "feature") {
      if (typeof value.enabled !== "boolean" || value.limitValue !== null) {
        throw new Error(`Feature inválida: ${value.key}`);
      }
    } else if (value.enabled !== null || !Number.isSafeInteger(value.limitValue) || (value.limitValue ?? -1) < 0) {
      throw new Error(`Limite inválido: ${value.key}`);
    }
    return {
      key: value.key,
      enabled: value.enabled,
      limit_value: value.limitValue,
    };
  }));
}

export async function replacePlatformTemplateEntitlements(
  sql: BillingSqlExecutor,
  templateId: string,
  values: TenantPlanEntitlementInput[],
): Promise<void> {
  const rows = await sql.query(
    `with target as (
       select id from public.plan_templates where id=$1
     ), deleted as (
       delete from public.plan_template_entitlements
       where template_id in (select id from target)
       returning entitlement_key
     ), input as (
       select * from jsonb_to_recordset($2::jsonb)
         as x(key text,enabled boolean,limit_value bigint)
     ), inserted as (
       insert into public.plan_template_entitlements (
         template_id,entitlement_key,enabled,limit_value
       )
       select $1,i.key,i.enabled,i.limit_value
       from input i cross join target
       returning entitlement_key
     )
     select (select count(*) from target)::integer as target_count`,
    [templateId, payload(values)],
  );
  if (Number(rows[0]?.["target_count"] ?? 0) !== 1) {
    throw new Error("Template não encontrado");
  }
}
