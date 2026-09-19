import { Link } from "@tanstack/react-router";
import {
  DashboardIcon,
  type DashboardIconName,
} from "../dashboard/DashboardIcon.tsx";

interface MasterSidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavigationItem {
  to: string;
  label: string;
  exact: boolean;
  icon: DashboardIconName;
}

interface NavigationGroup {
  label: string;
  items: readonly NavigationItem[];
}

const navigation: readonly NavigationGroup[] = [
  {
    label: "Operação",
    items: [
      { to: "/master", label: "Visão geral", exact: true, icon: "home" },
      { to: "/master/platforms", label: "White Labels", exact: false, icon: "platforms" },
      { to: "/master/billing", label: "Faturamento", exact: false, icon: "billing" },
      { to: "/master/support", label: "Suporte", exact: false, icon: "support" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/master/audit", label: "Auditoria", exact: false, icon: "audit" },
      { to: "/master/infrastructure", label: "Infraestrutura", exact: false, icon: "infrastructure" },
      { to: "/master/settings", label: "Configurações", exact: false, icon: "settings" },
    ],
  },
];

export function MasterSidebar({ open, onClose }: Readonly<MasterSidebarProps>) {
  return (
    <>
      <button
        type="button"
        className={open ? "master-overlay is-open" : "master-overlay"}
        onClick={onClose}
        aria-label="Fechar menu"
      />
      <aside className={open ? "master-sidebar is-open" : "master-sidebar"} aria-label="Navegação principal">
        <div className="master-brand">
          <span className="master-brand__mark" aria-hidden="true">K</span>
          <div>
            <strong>Kataluu</strong>
            <small>Administração da plataforma</small>
          </div>
        </div>
        <nav className="master-nav" aria-label="Super Admin">
          {navigation.map((group) => (
            <div className="console-nav-group" key={group.label}>
              <span className="console-nav-group__label">{group.label}</span>
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  activeProps={{ "data-active": "true" }}
                  className="master-nav__link"
                  onClick={onClose}
                >
                  <DashboardIcon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="master-sidebar__footer console-sidebar-context">
          <span>Ambiente</span>
          <strong>Super Admin Kataluu</strong>
        </div>
      </aside>
    </>
  );
}
