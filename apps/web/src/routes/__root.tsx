import { createRootRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <div style={{ fontFamily: "system-ui", maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
        <strong>White Label Platform</strong>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link to="/">Início</Link>
          <Link to="/master">Master</Link>
          <Link to="/control">Control</Link>
          <Link to="/admin">Admin</Link>
          <Link to="/catalog">Catálogo</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  ),
});