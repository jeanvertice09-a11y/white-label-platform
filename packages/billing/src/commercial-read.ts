import type {
  PlanEntitlementValue,
  PlanTemplateView,
  TenantCommercialPlan,
  TenantPlanCatalog,
} from "./commercial-types.ts";
import type { BillingSqlExecutor } from "./postgres-entitlements.ts";

type Row = Record<string, unknown>;

interface CatalogRows {
  templates: Row[];
  templateEntitlements: Row[];
  plans: Row[];
  planEntitlements: Row[];
}

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

function mapEntitlement(row: Row): PlanEntitlementValue {
  return {
    key: text(row, "entitlement_key"),
    kind: text(row, "kind") as PlanEntitlementValue["kind"],
    name: text(row, "entitlement_name"),
    unit: nullableText(row, "unit"),
    enabled: row["enabled"] === null ? null : boolValue(row, "enabled"),
    limitValue: row["limit_value"] === null ? null : numberValue(row, "limit_value"),
  };
}

function groupEntitlements(rows: Row[], idKey: string): Map<string, PlanEntitlementValue[]> {
  const out = new Map<string, PlanEntitlementValue[]>();
  for (const row of rows) {
    const ownerId = text(row, idKey);
    const values = out.get(ownerId) ?? [];
    values.push(mapEntitlement(row));
    out.set(ownerId, values);
  }
  return out;
}

async function loadCatalogRows(sql: BillingSqlExecutor, tenantId: string): Promise<CatalogRows> {
  const [templates, templateEntitlements, plans, planEntitlements] = await Promise.all([
    sql.query(
      `select id,code,name,description,active,sort_order
       from public.plan_templates
       where active=true
       order by sort_order,name`,
      [],
    ),
    sql.query(
      `select te.template_id,d.key as entitlement_key,d.kind,d.name as entitlement_name,d.unit,
         te.enabled,te.limit_value
       from public.plan_template_entitlements te
       join public.entitlement_definitions d on d.key=te.entitlement_key and d.active=true
       join public.plan_templates t on t.id=te.template_id and t.active=true
       order by te.template_id,d.kind,d.key`,
      [],
    ),
    sql.query(
      `select p.id,p.tenant_id,p.template_id,t.code as template_code,p.slug,p.name,p.description,
         p.price_cents,p.billing_interval,p.active,p.trial_enabled,p.trial_days,
         p.display_order,p.recommended
       from public.tenant_plans p
       join public.plan_templates t on t.id=p.template_id
       where p.tenant_id=$1
       order by p.display_order,p.created_at`,
      [tenantId],
    ),
    sql.query(
      `select e.tenant_plan_id,d.key as entitlement_key,d.kind,d.name as entitlement_name,d.unit,
         e.enabled,e.limit_value
       from public.tenant_plan_entitlements e
       join public.entitlement_definitions d on d.key=e.entitlement_key and d.active=true
       where e.tenant_id=$1
       order by e.tenant_plan_id,d.kind,d.key`,
      [tenantId],
    ),
  ]);
  return { templates, templateEntitlements, plans, planEntitlements };
}

function mapTemplates(rows: CatalogRows): PlanTemplateView[] {
  const entitlements = groupEntitlements(rows.templateEntitlements, "template_id");
  return rows.templates.map((row) => ({
    id: text(row, "id"),
    code: text(row, "code"),
    name: text(row, "name"),
    description: nullableText(row, "description"),
    active: boolValue(row, "active"),
    sortOrder: numberValue(row, "sort_order"),
    entitlements: entitlements.get(text(row, "id")) ?? [],
  }));
}

function mapPlans(rows: CatalogRows): TenantCommercialPlan[] {
  const entitlements = groupEntitlements(rows.planEntitlements, "tenant_plan_id");
  return rows.plans.map((row) => ({
    id: text(row, "id"),
    tenantId: text(row, "tenant_id"),
    templateId: text(row, "template_id"),
    templateCode: text(row, "template_code"),
    slug: text(row, "slug"),
    name: text(row, "name"),
    description: nullableText(row, "description"),
    priceCents: numberValue(row, "price_cents"),
    billingInterval: text(row, "billing_interval") as TenantCommercialPlan["billingInterval"],
    active: boolValue(row, "active"),
    trialEnabled: boolValue(row, "trial_enabled"),
    trialDays: numberValue(row, "trial_days"),
    displayOrder: numberValue(row, "display_order"),
    recommended: boolValue(row, "recommended"),
    entitlements: entitlements.get(text(row, "id")) ?? [],
  }));
}

export async function listTenantPlanCatalog(
  sql: BillingSqlExecutor,
  tenantId: string,
): Promise<TenantPlanCatalog> {
  const rows = await loadCatalogRows(sql, tenantId);
  return { templates: mapTemplates(rows), plans: mapPlans(rows) };
}
