import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { CatalogMerchandising } from "@white-label/catalog";
import { saveMerchantCatalogMerchandising } from "../../lib/server/catalog-merchandising.functions.ts";

function localDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function iso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function CatalogMerchandisingForm({
  initial,
}: Readonly<{ initial: CatalogMerchandising }>): React.JSX.Element {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const saved = await saveMerchantCatalogMerchandising({ data: {
        enabled: form.get("enabled") === "on",
        text: String(form.get("text") ?? ""),
        href: String(form.get("href") ?? "").trim() || null,
        startsAt: iso(String(form.get("startsAt") ?? "")),
        endsAt: iso(String(form.get("endsAt") ?? "")),
        countdown: form.get("countdown") === "on",
      } });
      setValue(saved); setMessage("Merchandising do catálogo atualizado.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o merchandising.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="k-workspace-section">
    <header className="k-section-head"><div><span className="k-section-kicker">Merchandising</span><h2>Barra promocional</h2><p>Exiba uma mensagem promocional com período e countdown opcionais. A vigência pública é resolvida no servidor.</p></div></header>
    <form className="k-form" onSubmit={(event) => { void submit(event); }}>
      <div className="k-card k-form__grid">
        <label className="k-check"><input name="enabled" type="checkbox" defaultChecked={value.enabled} />Barra promocional ativa</label>
        <div className="k-field k-field--full"><label>Texto</label><input name="text" maxLength={120} defaultValue={value.text} placeholder="Frete grátis nesta semana" /></div>
        <div className="k-field k-field--full"><label>Link seguro</label><input name="href" maxLength={120} defaultValue={value.href ?? ""} placeholder="/categoria/ofertas ou https://..." /></div>
        <div className="k-field"><label>Início</label><input name="startsAt" type="datetime-local" defaultValue={localDateTime(value.startsAt)} /></div>
        <div className="k-field"><label>Fim</label><input name="endsAt" type="datetime-local" defaultValue={localDateTime(value.endsAt)} /></div>
        <label className="k-check"><input name="countdown" type="checkbox" defaultChecked={value.countdown} />Mostrar countdown até o fim</label>
      </div>
      <div className="k-actions">{message ? <span className="k-status" role="status">{message}</span> : null}<button className="k-button k-button--primary" type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar promoção"}</button></div>
    </form>
  </section>;
}
