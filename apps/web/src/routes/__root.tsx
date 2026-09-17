import type { ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kataluu" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
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
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
