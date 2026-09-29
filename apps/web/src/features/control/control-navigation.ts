import type { DashboardIconName } from "../../components/dashboard/DashboardIcon.tsx";

export type ControlPlanSection = "plans" | "resources";

export interface ControlNavigationItem {
  to: string;
  label: string;
  icon: DashboardIconName;
  exact?: boolean;
  planSection?: ControlPlanSection;
}

export interface ControlNavigationGroup {
  label: string;
  items: readonly ControlNavigationItem[];
}

export const controlNavigation: readonly ControlNavigationGroup[] = [
  {
    label: "Visão geral",
    items: [{ to: "/control", label: "Visão geral", icon: "home", exact: true }],
  },
  {
    label: "Lojistas",
    items: [
      { to: "/control/stores", label: "Lojas", icon: "store" },
      { to: "/control/billing", label: "Assinaturas e cobranças", icon: "billing" },
    ],
  },
  {
    label: "Planos",
    items: [
      { to: "/control/plans", label: "Planos comerciais", icon: "subscriptions", planSection: "plans" },
      { to: "/control/plans", label: "Recursos e limites", icon: "check", planSection: "resources" },
    ],
  },
  {
    label: "Marca e canais",
    items: [
      { to: "/control/branding", label: "Identidade visual", icon: "palette" },
      { to: "/control/domains", label: "Domínios", icon: "domains" },
      { to: "/control/payments", label: "Meios de pagamento", icon: "integrations" },
    ],
  },
  {
    label: "Administração",
    items: [
      { to: "/control/team", label: "Equipe e acessos", icon: "support" },
      { to: "/control/audit", label: "Auditoria", icon: "audit" },
    ],
  },
];

export function isControlNavigationItemActive(
  item: ControlNavigationItem,
  pathname: string,
  href = pathname,
): boolean {
  if (item.to === "/control") return pathname === "/control" || pathname === "/control/";
  if (item.to === "/control/stores") {
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  }
  if (pathname !== item.to) return false;
  if (item.to !== "/control/plans") return true;
  const resources = /(?:\?|&)section=resources(?:&|$)/.test(href);
  return item.planSection === "resources" ? resources : !resources;
}
