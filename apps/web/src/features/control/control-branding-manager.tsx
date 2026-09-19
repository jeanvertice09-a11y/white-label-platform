import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { updateControlBrandingAction } from "../../lib/server/control-branding.functions.ts";
import type { TenantControlDashboardData } from "../../lib/server/platform-console.types.ts";

type Tenant = TenantControlDashboardData["tenant"];

function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function ControlBrandingManager({ initial }: Readonly<{ initial: Tenant }>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      await updateControlBrandingAction({ data: {
        name: formText(form, "name"),
        logoUrl: formText(form, "logoUrl"),
        primaryColor: formText(form, "primaryColor"),
      } });
      setMessage("Branding atualizado.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar branding.");
    } finally { setBusy(false); }
  }

  return <section className="control-section" id="branding-management">
    <div className="control-section__head"><div><span className="control-kicker">Identidade</span><h2>Configurar branding</h2><p>Edite somente os campos suportados pelo schema atual da White Label.</p></div></div>
    <form className="control-editorial-section" onSubmit={(event) => { void save(event); }}>
      <div className="k-form__grid">
        <div className="k-field"><label htmlFor="control-brand-name">Nome</label><input id="control-brand-name" name="name" defaultValue={initial.name} required maxLength={120} /></div>
        <div className="k-field"><label htmlFor="control-brand-color">Cor primária</label><input id="control-brand-color" name="primaryColor" defaultValue={initial.primaryColor ?? ""} placeholder="#315efb" /></div>
        <div className="k-field k-field--full"><label htmlFor="control-brand-logo">Logo URL</label><input id="control-brand-logo" name="logoUrl" type="url" defaultValue={initial.logoUrl ?? ""} placeholder="https://..." /></div>
      </div>
      <div className="k-actions"><button className="k-button k-button--primary" type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar branding"}</button></div>
      {message ? <div className="k-status" role="status">{message}</div> : null}
    </form>
  </section>;
}
