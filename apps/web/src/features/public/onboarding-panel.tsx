import type { ControlOnboardingData, OnboardingItem } from "../../lib/control-onboarding.types.ts";

function ChecklistItem({ item }: Readonly<{ item: OnboardingItem }>): React.JSX.Element {
  return (
    <li className={`onboarding-item ${item.done ? "is-done" : ""}`}>
      <span className="onboarding-item__status" aria-hidden="true">{item.done ? "✓" : ""}</span>
      <div><div className="onboarding-item__title"><strong>{item.title}</strong><small>{item.required ? "Essencial" : "Opcional"}</small></div><p>{item.description}</p>{!item.done && item.actionHref && item.actionLabel ? <a href={item.actionHref}>{item.actionLabel} →</a> : null}</div>
    </li>
  );
}

function Progress({ data }: Readonly<{ data: ControlOnboardingData }>): React.JSX.Element {
  const progress = Math.round((data.completedRequired / data.requiredCount) * 100);
  return (
    <div className="onboarding-progress"><div><span>Configuração essencial</span><strong>{data.completedRequired} de {data.requiredCount}</strong></div><div className="onboarding-progress__track" aria-label={`${String(progress)}% concluído`}><span style={{ width: `${String(progress)}%` }} /></div></div>
  );
}

export function OnboardingPanel({ data }: Readonly<{ data: ControlOnboardingData }>): React.JSX.Element {
  return (
    <main className="onboarding-page"><div className="onboarding-shell"><a className="onboarding-back" href="/control">Ir para o painel</a><header><span className="public-eyebrow">Primeiros passos</span><h1>Prepare {data.tenantName} para operar.</h1><p>O progresso é calculado a partir da configuração persistida da sua White Label. Nada precisa ser marcado manualmente.</p></header><Progress data={data} /><ol className="onboarding-list">{data.items.map((item) => <ChecklistItem key={item.key} item={item} />)}</ol><div className="onboarding-note"><strong>Identidade ainda incompleta?</strong><p>Nome, logo e cor principal já existem no schema. A edição dessa identidade permanece no fluxo administrativo; aqui o estado é apenas refletido, sem criar persistência paralela.</p></div><a className="public-button public-button--primary" href="/control">Continuar no painel</a></div></main>
  );
}
