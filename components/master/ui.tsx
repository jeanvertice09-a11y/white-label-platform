import type { ReactNode } from "react";
import {
  DashboardIcon,
  type DashboardIconName,
} from "../dashboard/DashboardIcon.tsx";

export function MasterPageHeader(props: Readonly<{
  title: string;
  description: string;
  action?: ReactNode;
}>) {
  return (
    <header className="master-page-header">
      <div className="master-page-header__copy">
        <span className="console-page-kicker">Kataluu / {props.title}</span>
        <h1>{props.title}</h1>
        <p>{props.description}</p>
      </div>
      {props.action ? <div className="master-page-header__actions">{props.action}</div> : null}
    </header>
  );
}

export function MasterMetricCard(props: Readonly<{
  label: string;
  value?: string;
  detail: string;
  icon: DashboardIconName;
}>) {
  return (
    <div className="master-metric">
      <div className="master-metric__heading">
        <span className="master-metric__icon" aria-hidden="true">
          <DashboardIcon name={props.icon} />
        </span>
        <span>{props.label}</span>
      </div>
      <strong>{props.value ?? "—"}</strong>
      <small>{props.detail}</small>
    </div>
  );
}

export function MasterPanel(props: Readonly<{
  title: string;
  children: ReactNode;
}>) {
  return (
    <section className="master-panel master-editorial-section">
      <div className="master-panel__header"><h2>{props.title}</h2></div>
      <div className="master-panel__body">{props.children}</div>
    </section>
  );
}

export function MasterEmptyState(props: Readonly<{
  title: string;
  description: string;
}>) {
  return (
    <div className="master-empty">
      <strong>{props.title}</strong>
      <p>{props.description}</p>
    </div>
  );
}
