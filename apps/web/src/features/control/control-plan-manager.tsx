import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type {
  PlanTemplateView,
  TenantCommercialPlan,
  TenantPlanCatalog,
  TenantPlanEntitlementInput,
} from "@white-label/billing";
import {
  saveControlPlan,
  saveControlPlanEntitlements,
} from "../../lib/server/commercial-plans.functions.ts";

function centsFromInput(value: FormDataEntryValue | null): number {
  const raw = String(value ?? "").trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Preço inválido");
  return Math.round(parsed * 100);
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function slugFromTemplate(template: PlanTemplateView): string {
  return template.code.replaceAll("_", "-");
}

function planInput(form: FormData, template: PlanTemplateView) {
  const trialEnabled = form.get("trialEnabled") === "on";
  return {
    templateId: template.id,
    slug: String(form.get("slug") ?? slugFromTemplate(template)),
    name: String(form.get("name") ?? template.name),
    description: String(form.get("description") ?? "").trim() || null,
    priceCents: centsFromInput(form.get("price")),
    billingInterval: String(form.get("billingInterval")) as "monthly" | "quarterly" | "yearly",
    active: form.get("active") === "on",
    trialEnabled,
    trialDays: trialEnabled ? Number(form.get("trialDays") ?? 0) : 0,
    displayOrder: Number(form.get("displayOrder") ?? template.sortOrder),
    recommended: form.get("recommended") === "on",
  };
}

function entitlementPayload(
  form: FormData,
  template: PlanTemplateView,
): TenantPlanEntitlementInput[] {
  return template.entitlements.map((item) => {
    if (item.kind === "feature") {
      return {
        key: item.key,
        kind: item.kind,
        enabled: form.get(`feature:${item.key}`) === "on",
        limitValue: null,
      };
    }
    return {
      key: item.key,
      kind: item.kind,
      enabled: null,
      limitValue: Number(form.get(`limit:${item.key}`) ?? 0),
    };
  });
}

function PlanEntitlements(props: Readonly<{
  template: PlanTemplateView;
  plan: TenantCommercialPlan;
  busy: boolean;
  onSave: (values: TenantPlanEntitlementInput[]) => Promise<void>;
}>): React.JSX.Element {
  const current = new Map(props.plan.entitlements.map((item) => [item.key, item]));
  if (!props.template.entitlements.length) {
    return <div className="control-empty">A Kataluu ainda não autorizou recursos/limites para este template.</div>;
  }
  return (
    <form className="control-plan-entitlements" onSubmit={(event) => {
      event.preventDefault();
      void props.onSave(entitlementPayload(new FormData(event.currentTarget), props.template));
    }}>
      <h4>Recursos e limites</h4>
      {props.template.entitlements.map((item) => {
        const saved = current.get(item.key);
        if (item.kind === "feature") {
          return (
            <label className="control-plan-feature" key={item.key}>
              <input
                type="checkbox"
                name={`feature:${item.key}`}
                defaultChecked={saved?.enabled === true}
                disabled={item.enabled !== true}
              />
              <span><strong>{item.name}</strong><small>{item.key}</small></span>
              <em>{item.enabled === true ? "Permitido" : "Bloqueado pela Kataluu"}</em>
            </label>
          );
        }
        return (
          <label className="control-plan-limit" key={item.key}>
            <span><strong>{item.name}</strong><small>Teto Kataluu: {item.limitValue ?? 0} {item.unit ?? ""}</small></span>
            <input
              type="number"
              min={0}
              max={item.limitValue ?? 0}
              name={`limit:${item.key}`}
              defaultValue={saved?.limitValue ?? 0}
            />
          </label>
        );
      })}
      <button className="control-plan-button" disabled={props.busy} type="submit">Salvar recursos</button>
    </form>
  );
}

function TemplateCard(props: Readonly<{
  template: PlanTemplateView;
  plan?: TenantCommercialPlan;
}>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function savePlan(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await saveControlPlan({ data: planInput(new FormData(event.currentTarget), props.template) });
      setMessage("Plano salvo.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o plano.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEntitlements(values: TenantPlanEntitlementInput[]): Promise<void> {
    if (!props.plan) return;
    setBusy(true);
    setMessage("");
    try {
      await saveControlPlanEntitlements({ data: { planId: props.plan.id, values } });
      setMessage("Recursos atualizados.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar os recursos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="control-card control-plan-card">
      <div className="control-plan-card__head">
        <div><span className="control-kicker">Template Kataluu</span><h3>{props.template.name}</h3><p>{props.template.description ?? "Sem descrição."}</p></div>
        <span className="control-badge">{props.plan ? "Configurado" : "Disponível"}</span>
      </div>
      <form className="control-plan-form" onSubmit={(event) => { void savePlan(event); }}>
        <label>Nome comercial<input name="name" required defaultValue={props.plan?.name ?? props.template.name} /></label>
        <label>Slug<input name="slug" required defaultValue={props.plan?.slug ?? slugFromTemplate(props.template)} /></label>
        <label className="control-plan-form__wide">Descrição<textarea name="description" defaultValue={props.plan?.description ?? ""} /></label>
        <label>Preço (R$)<input name="price" inputMode="decimal" required defaultValue={centsToInput(props.plan?.priceCents ?? 0)} /></label>
        <label>Periodicidade<select name="billingInterval" defaultValue={props.plan?.billingInterval ?? "monthly"}><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select></label>
        <label>Ordem<input name="displayOrder" type="number" min={0} defaultValue={props.plan?.displayOrder ?? props.template.sortOrder} /></label>
        <label>Dias de trial<input name="trialDays" type="number" min={0} max={365} defaultValue={props.plan?.trialDays ?? 0} /></label>
        <label className="control-plan-check"><input name="active" type="checkbox" defaultChecked={props.plan?.active ?? true} />Ativo</label>
        <label className="control-plan-check"><input name="trialEnabled" type="checkbox" defaultChecked={props.plan?.trialEnabled ?? false} />Trial habilitado</label>
        <label className="control-plan-check"><input name="recommended" type="checkbox" defaultChecked={props.plan?.recommended ?? false} />Recomendado</label>
        <button className="control-plan-button" disabled={busy} type="submit">{props.plan ? "Salvar plano" : "Ativar e salvar"}</button>
      </form>
      {message ? <div className="control-plan-message">{message}</div> : null}
      {props.plan ? <PlanEntitlements template={props.template} plan={props.plan} busy={busy} onSave={saveEntitlements} /> : null}
    </article>
  );
}

export function ControlPlanManager({ catalog }: Readonly<{ catalog: TenantPlanCatalog }>): React.JSX.Element {
  const plans = new Map(catalog.plans.map((plan) => [plan.templateId, plan]));
  return (
    <div className="control-plan-list">
      {catalog.templates.length
        ? catalog.templates.map((template) => <TemplateCard key={template.id} template={template} plan={plans.get(template.id)} />)
        : <div className="control-empty">Nenhum template de plano ativo na Kataluu.</div>}
    </div>
  );
}
