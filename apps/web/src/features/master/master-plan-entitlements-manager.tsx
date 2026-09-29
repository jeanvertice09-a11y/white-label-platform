import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { PlanTemplateView, TenantPlanEntitlementInput } from "@white-label/billing";
import { MasterEmptyState, MasterPanel } from "../../components/master/ui.tsx";
import { savePlatformTemplateEntitlements } from "../../lib/server/platform-plan-templates.functions.ts";

export function MasterPlanEntitlementsManager({ templates }: Readonly<{ templates: PlanTemplateView[] }>): React.JSX.Element {
  if (!templates.length) return <MasterEmptyState title="Sem templates" description="Nenhum template de plano está cadastrado na plataforma." />;
  return <div className="k-stack">{templates.map((template) => <TemplateEditor key={template.id} template={template} />)}</div>;
}

function TemplateEditor({ template }: Readonly<{ template: PlanTemplateView }>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      const values = template.entitlements.map((item): TenantPlanEntitlementInput => {
        if (item.kind === "feature") {
          return { key: item.key, kind: item.kind, enabled: form.get(`feature:${item.key}`) === "on", limitValue: null };
        }
        const raw = form.get(`limit:${item.key}`);
        const limitValue = typeof raw === "string" && raw.trim() ? Number(raw) : Number.NaN;
        if (!Number.isSafeInteger(limitValue) || limitValue < 0) throw new Error(`Informe um limite válido para ${item.name}.`);
        return { key: item.key, kind: item.kind, enabled: null, limitValue };
      });
      await savePlatformTemplateEntitlements({ data: { templateId: template.id, values } });
      setMessage("Entitlements atualizados.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar os entitlements.");
    } finally {
      setBusy(false);
    }
  }

  return <MasterPanel title={`${template.name} · ${template.code}`}>
    {template.description ? <p>{template.description}</p> : null}
    <p>Status do template: <strong>{template.active ? "Ativo" : "Inativo"}</strong></p>
    {template.entitlements.length ? <form className="k-form" onSubmit={(event) => { void submit(event); }}>
      <div className="master-table-wrap"><table className="master-table"><thead><tr><th>Recurso</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>{template.entitlements.map((item) => <tr key={item.key}>
        <td><strong>{item.name}</strong><div>{item.key}{item.unit ? ` · ${item.unit}` : ""}</div></td>
        <td>{item.kind === "feature" ? "Recurso" : "Limite"}</td>
        <td>{item.kind === "feature"
          ? <label><input type="checkbox" name={`feature:${item.key}`} defaultChecked={item.enabled === true} /> Habilitado</label>
          : <input aria-label={`Limite de ${item.name}`} type="number" min={0} step={1} required name={`limit:${item.key}`} defaultValue={item.limitValue ?? ""} />}</td>
      </tr>)}</tbody></table></div>
      <div className="k-actions"><button className="k-button k-button--primary" disabled={busy}>{busy ? "Salvando…" : "Salvar entitlements"}</button></div>
    </form> : <MasterEmptyState title="Sem entitlements atribuídos" description="Este template ainda não possui entitlements configurados no backend." />}
    {message ? <div className="k-status" role="status">{message}</div> : null}
  </MasterPanel>;
}
