import type { CSSProperties, ReactNode } from "react";

export const pageStyle: CSSProperties = {
  display: "grid",
  gap: 20,
};

export const cardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#ffffff",
  padding: 20,
  boxShadow: "0 1px 2px rgba(15,23,42,.04)",
};

export const gridStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 12px",
  font: "inherit",
  background: "#ffffff",
};

export const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: "10px 15px",
  background: "#111827",
  color: "#ffffff",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
};

export const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "#f3f4f6",
  color: "#111827",
};

export function AdminPage(props: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div style={pageStyle}>
      <header style={{ display: "flex", gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>{props.title}</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>{props.description}</p>
        </div>
        {props.actions}
      </header>
      {props.children}
    </div>
  );
}

export function Card(props: { children: ReactNode }): React.JSX.Element {
  return <section style={cardStyle}>{props.children}</section>;
}

export function Field(props: {
  label: string;
  children: ReactNode;
  hint?: string;
}): React.JSX.Element {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 14, fontWeight: 600 }}>
      <span>{props.label}</span>
      {props.children}
      {props.hint ? <small style={{ color: "#6b7280", fontWeight: 400 }}>{props.hint}</small> : null}
    </label>
  );
}

export function EmptyState(props: { title: string; text: string }): React.JSX.Element {
  return (
    <div style={{ textAlign: "center", padding: "36px 16px", color: "#6b7280" }}>
      <strong style={{ display: "block", color: "#111827", marginBottom: 6 }}>{props.title}</strong>
      <span>{props.text}</span>
    </div>
  );
}

export function Money(props: { cents: number }): React.JSX.Element {
  const value = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(props.cents / 100);
  return <>{value}</>;
}
