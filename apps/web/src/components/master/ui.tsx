import type { ReactNode } from "react";

export function MasterPageHeader(props: Readonly<{
  title: string;
  description: string;
  action?: ReactNode;
}>) {
  return (
    <header className="master-page-header">
      <div>
        <h1>{props.title}</h1>
        <p>{props.description}</p>
      </div>
      {props.action}
    </header>
  );
}

export function MasterMetricCard(props: Readonly<{
  label: string;
  value?: string;
  detail: string;
}>) {
  return (
    <article className="master-card master-metric">
      <span>{props.label}</span>
      <strong>{props.value ?? "—"}</strong>
      <small>{props.detail}</small>
    </article>
  );
}

export function MasterPanel(props: Readonly<{
  title: string;
  children: ReactNode;
}>) {
  return (
    <section className="master-card master-panel">
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}

export function MasterEmptyState(props: Readonly<{
  title: string;
  description: string;
}>) {
  return (
    <div className="master-empty">
      <span className="master-empty__mark" aria-hidden="true">•</span>
      <strong>{props.title}</strong>
      <p>{props.description}</p>
    </div>
  );
}
