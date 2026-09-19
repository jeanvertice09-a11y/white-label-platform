import type { SqlExecutor } from "@white-label/domains";
import type { ControlOnboardingData, OnboardingItem } from "../control-onboarding.types.ts";

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function flag(row: Row, key: string): boolean {
  return row[key] === true;
}

function buildItems(row: Row): OnboardingItem[] {
  return [
    {
      key: "identity",
      title: "Identidade da White Label",
      description: "Nome, logo e cor principal formam a apresentação pública da sua plataforma.",
      done: flag(row, "identity_ready"),
      required: true,
      actionHref: null,
      actionLabel: null,
    },
    {
      key: "domain",
      title: "Domínio verificado",
      description: "Publique o site ou painel em um domínio validado por DNS.",
      done: flag(row, "domain_ready"),
      required: true,
      actionHref: "/control#domain-management",
      actionLabel: "Configurar domínio",
    },
    {
      key: "plan",
      title: "Oferta comercial",
      description: "Ative ao menos um plano para organizar recursos e limites dos lojistas.",
      done: flag(row, "plan_ready"),
      required: true,
      actionHref: "/control#plan-management",
      actionLabel: "Configurar planos",
    },
    {
      key: "store",
      title: "Primeiro lojista",
      description: "Cadastre a primeira loja para validar o fluxo operacional da White Label.",
      done: flag(row, "store_ready"),
      required: true,
      actionHref: "/control#merchant-management",
      actionLabel: "Cadastrar lojista",
    },
    {
      key: "gateway",
      title: "Gateway de cobrança",
      description: "Opcional nesta etapa. Configure quando sua operação de cobrança exigir.",
      done: flag(row, "gateway_ready"),
      required: false,
      actionHref: "/control#gateway-management",
      actionLabel: "Revisar gateways",
    },
  ];
}

export async function loadControlOnboarding(
  sql: SqlExecutor,
  tenantId: string,
): Promise<ControlOnboardingData> {
  const rows = await sql.query(
    `select t.name,
       exists(select 1 from public.tenant_branding b where b.tenant_id=t.id
         and nullif(trim(b.logo_url),'') is not null and nullif(trim(b.primary_color),'') is not null) identity_ready,
       exists(select 1 from public.domains d where d.tenant_id=t.id
         and d.type in ('tenant_panel','tenant_site') and d.status='active' and d.verified_at is not null) domain_ready,
       exists(select 1 from public.tenant_plans p where p.tenant_id=t.id and p.active=true) plan_ready,
       exists(select 1 from public.stores s where s.tenant_id=t.id) store_ready,
       exists(select 1 from public.gateway_accounts g where g.tenant_id=t.id
         and g.store_id is null and g.level='tenant_billing' and g.status='active') gateway_ready
     from public.tenants t where t.id=$1::uuid limit 1`,
    [tenantId],
  );
  const row = rows.at(0);
  if (!row) throw new Error("White Label não encontrada.");
  const items = buildItems(row);
  const requiredItems = items.filter((item) => item.required);
  const completedRequired = requiredItems.filter((item) => item.done).length;
  return {
    tenantName: text(row, "name"),
    complete: completedRequired === requiredItems.length,
    completedRequired,
    requiredCount: requiredItems.length,
    items,
  };
}
