import { useState } from "react";
import type { ControlMerchantPlanOption } from "../../lib/server/control-merchants.types.ts";
import { createControlMerchantAction } from "../../lib/server/control-merchants.functions.ts";

function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function ControlMerchantCreateForm(props: Readonly<{
  plans: ControlMerchantPlanOption[];
  onCreated: () => Promise<void>;
}>): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const planId = formText(form, "planId") || null;
    setBusy(true);
    setMessage("");
    try {
      const result = await createControlMerchantAction({
        data: {
          name: formText(form, "name"),
          slug: formText(form, "slug"),
          ownerEmail: formText(form, "ownerEmail"),
          planId,
          useTrial: form.get("useTrial") === "on",
        },
      });
      setMessage(result.created ? "Lojista criado." : "Cadastro já existia; nenhuma duplicação criada.");
      event.currentTarget.reset();
      await props.onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o lojista.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="control-card" onSubmit={(event) => { void submit(event); }}>
      <h3>Novo lojista</h3>
      <div className="k-form__grid">
        <div className="k-field"><label htmlFor="merchant-name">Loja</label><input id="merchant-name" name="name" required /></div>
        <div className="k-field"><label htmlFor="merchant-slug">Slug</label><input id="merchant-slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></div>
        <div className="k-field k-field--full"><label htmlFor="merchant-owner">E-mail do responsável existente</label><input id="merchant-owner" name="ownerEmail" type="email" required /></div>
        <div className="k-field"><label htmlFor="merchant-plan">Plano</label><select id="merchant-plan" name="planId"><option value="">Sem plano</option>{props.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></div>
        <label className="k-field"><span>Trial</span><input name="useTrial" type="checkbox" /> Usar trial do plano</label>
      </div>
      {message ? <div className="k-status">{message}</div> : null}
      <div className="k-actions"><button className="k-button k-button--primary" disabled={busy} type="submit">Criar lojista</button></div>
    </form>
  );
}
