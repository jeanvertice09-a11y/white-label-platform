import type { OnboardingStep } from "../../lib/onboarding-progress.ts";

export interface OnboardingData {
  facts: { categoryCount: number; productCount: number };
  steps: OnboardingStep[];
  progress: { completed: number; total: number; percent: number };
}

export function OnboardingChecklist({ data }: Readonly<{ data: OnboardingData }>): React.JSX.Element {
  const width = `${String(data.progress.percent)}%`;
  return (
    <>
      <section className="k-card k-onboarding__progress" aria-label="Progresso do onboarding">
        <div><strong>{data.progress.percent}%</strong><span>{data.progress.completed} de {data.progress.total} etapas essenciais concluídas</span></div>
        <div className="k-onboarding__bar" aria-hidden="true"><span style={{ width }} /></div>
        <p>O progresso é recalculado com os dados reais da loja. Você pode sair e voltar sem perder o avanço.</p>
      </section>
      <section className="k-onboarding__steps">
        {data.steps.map((step, index) => (
          <article className={step.complete ? "k-card k-onboarding__step is-complete" : "k-card k-onboarding__step"} key={step.id}>
            <div className="k-onboarding__number" aria-hidden="true">{step.complete ? "✓" : index + 1}</div>
            <div className="k-onboarding__copy">
              <div className="k-onboarding__title"><h2>{step.title}</h2>{step.optional ? <span>Opcional</span> : null}</div>
              <p>{step.description}</p>
              {step.id === "categories" ? <small>{data.facts.categoryCount} categoria(s) cadastrada(s)</small> : null}
              {step.id === "products" ? <small>{data.facts.productCount} produto(s) cadastrado(s)</small> : null}
            </div>
            <a className="k-button k-button--ghost" href={step.href}>{step.complete ? "Revisar" : "Continuar"}</a>
          </article>
        ))}
      </section>
    </>
  );
}
