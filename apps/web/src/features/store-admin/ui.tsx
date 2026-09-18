import type { CSSProperties, ReactNode } from "react";

export const pageStyle: CSSProperties = {
  display: "grid",
  gap: 22,
};

export const cardStyle: CSSProperties = {
  border: "1px solid #e7ebf3",
  borderRadius: 16,
  background: "#ffffff",
  padding: 20,
  boxShadow: "0 2px 10px rgba(35,51,91,.025)",
};

export const gridStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 42,
  border: "1px solid #dce2ec",
  borderRadius: 10,
  padding: "10px 12px",
  font: "inherit",
  color: "#182033",
  background: "#ffffff",
  outline: "none",
};

export const buttonStyle: CSSProperties = {
  minHeight: 40,
  border: "1px solid #5468ff",
  borderRadius: 10,
  padding: "9px 14px",
  background: "#5468ff",
  color: "#ffffff",
  font: "inherit",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(84,104,255,.2)",
};

export const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: "1px solid #e7ebf3",
  background: "#ffffff",
  color: "#44516a",
  boxShadow: "none",
};

export function AdminPage(props: Readonly<{
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}>): React.JSX.Element {
  return (
    <div className="k-page">
      <header className="k-page__head">
        <div>
          <h1>{props.title}</h1>
          <p>{props.description}</p>
        </div>
        {props.actions}
      </header>
      {props.children}
    </div>
  );
}

export function Card(props: Readonly<{ children: ReactNode }>): React.JSX.Element {
  return <section className="k-card">{props.children}</section>;
}

export function Field(props: Readonly<{
  label: string;
  children: ReactNode;
  hint?: string;
}>): React.JSX.Element {
  return (
    <label className="k-field">
      <span>{props.label}</span>
      {props.children}
      {props.hint ? <small className="k-muted">{props.hint}</small> : null}
    </label>
  );
}

export function EmptyState(props: Readonly<{ title: string; text: string }>): React.JSX.Element {
  return (
    <div className="k-empty">
      <strong>{props.title}</strong>
      <span>{props.text}</span>
    </div>
  );
}

export function Money(props: Readonly<{ cents: number }>): React.JSX.Element {
  const value = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(props.cents / 100);
  return <>{value}</>;
}
