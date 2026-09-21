const STATUS_LABELS: Readonly<Record<string, string>> = {
  active: "Ativo",
  inactive: "Inativo",
  pending: "Pendente",
  trial: "Em período de teste",
  trialing: "Em período de teste",
  past_due: "Pagamento atrasado",
  suspended: "Suspenso",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  expired: "Expirado",
  paid: "Pago",
  failed: "Falhou",
  captured: "Pago",
  open: "Em aberto",
  settled: "Liquidado",
  draft: "Rascunho",
  received: "Recebida",
  prepared: "Preparada",
  scheduled: "Agendada",
};

const DOMAIN_TYPE_LABELS: Readonly<Record<string, string>> = {
  tenant_panel: "Painel da White Label",
  tenant_site: "Site da White Label",
  store_admin: "Painel administrativo da loja",
  store_catalog: "Loja pública",
};

const ROLE_LABELS: Readonly<Record<string, string>> = {
  platform_owner: "Responsável principal da plataforma",
  platform_admin: "Administrador da plataforma",
  platform_support: "Suporte da plataforma",
  platform_finance: "Financeiro da plataforma",
  tenant_owner: "Responsável principal",
  tenant_admin: "Administrador",
  tenant_finance: "Financeiro",
  tenant_support: "Suporte",
  store_owner: "Responsável principal",
  store_admin: "Administrador",
  store_manager: "Gerente",
  store_staff: "Equipe",
};

export function statusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return STATUS_LABELS[value] ?? value;
}

export function domainTypeLabel(value: string): string {
  return DOMAIN_TYPE_LABELS[value] ?? value;
}

export function roleLabel(value: string): string {
  return ROLE_LABELS[value] ?? value;
}

export function billingLevelLabel(value: string): string {
  if (value === "platform_billing") return "Assinatura Kataluu";
  if (value === "tenant_billing") return "Cobrança dos lojistas";
  if (value === "store_checkout") return "Pagamento da loja";
  return value;
}

export function layoutLabel(value: string): string {
  if (value === "classic") return "Clássico";
  if (value === "modern") return "Moderno";
  return value;
}
