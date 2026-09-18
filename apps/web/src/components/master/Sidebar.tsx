import { Link } from "@tanstack/react-router";

interface MasterSidebarProps {
  open: boolean;
  onClose: () => void;
}

const navigation = [
  { to: "/master", label: "Visão geral", exact: true },
  { to: "/master/platforms", label: "Plataformas", exact: false },
  { to: "/master/billing", label: "Faturamento", exact: false },
  { to: "/master/support", label: "Suporte", exact: false },
  { to: "/master/audit", label: "Auditoria", exact: false },
  { to: "/master/infrastructure", label: "Infraestrutura", exact: false },
  { to: "/master/settings", label: "Configurações", exact: false },
] as const;

export function MasterSidebar({ open, onClose }: Readonly<MasterSidebarProps>) {
  return (
    <>
      <button
        type="button"
        className={open ? "master-overlay is-open" : "master-overlay"}
        onClick={onClose}
        aria-label="Fechar menu"
      />
      <aside className={open ? "master-sidebar is-open" : "master-sidebar"}>
        <div className="master-brand">
          <span className="master-brand__mark" aria-hidden="true">K</span>
          <div>
            <strong>Kataluu</strong>
            <small>Controle geral</small>
          </div>
        </div>
        <nav className="master-nav" aria-label="Navegação do Super Admin">
          {navigation.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ "data-active": "true" }}
              className="master-nav__link"
              onClick={onClose}
            >
              <span className="master-nav__dot" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="master-sidebar__footer">
          <span>Status da plataforma</span>
          <strong>Operacional</strong>
        </div>
      </aside>
    </>
  );
}
