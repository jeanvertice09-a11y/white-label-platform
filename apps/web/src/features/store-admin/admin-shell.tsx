import type { ReactNode } from "react";

const items = [
  ["/admin", "Início"],
  ["/admin/products", "Produtos"],
  ["/admin/categories", "Categorias"],
  ["/admin/store/appearance", "Aparência"],
  ["/admin/store/banners", "Banners"],
  ["/admin/store/catalog", "Catálogo"],
] as const;

export function AdminShell(props: { children: ReactNode }): React.JSX.Element {
  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#fff",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          overflowX: "auto",
        }}
      >
        <strong style={{ whiteSpace: "nowrap" }}>Admin da loja</strong>
        <nav style={{ display: "flex", gap: 6 }}>
          {items.map(([href, label]) => (
            <a
              key={href}
              href={href}
              style={{
                textDecoration: "none",
                color: "#374151",
                padding: "8px 10px",
                borderRadius: 9,
                whiteSpace: "nowrap",
                fontSize: 14,
              }}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
      {props.children}
    </div>
  );
}
