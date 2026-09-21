import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { PublicStoreProfile } from "@white-label/catalog";
import { saveMerchantStoreProfile } from "../../lib/server/merchant-settings.functions.ts";

interface StoreDraft extends PublicStoreProfile {
  name: string;
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function MerchantStoreSettingsForm(props: Readonly<{ name: string; profile: PublicStoreProfile }>): React.JSX.Element {
  const router = useRouter();
  const [draft, setDraft] = useState<StoreDraft>({ name: props.name, ...props.profile });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const result = await saveMerchantStoreProfile({
        data: {
          name: draft.name,
          description: nullable(draft.description ?? ""),
          phone: nullable(draft.phone ?? ""),
          publicEmail: nullable(draft.publicEmail ?? ""),
          address: nullable(draft.address ?? ""),
          instagram: nullable(draft.instagram ?? ""),
        },
      });
      setDraft({ name: result.name, ...result.profile });
      setStatus("Informações da loja salvas.");
      await router.invalidate();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar as informações da loja.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="k-form" onSubmit={(event) => { void submit(event); }}>
      <div className="k-card k-form__grid">
        <div className="k-field k-field--full">
          <label htmlFor="store-name">Nome da loja</label>
          <input id="store-name" value={draft.name} maxLength={120} required onChange={(event) => { setDraft((current) => ({ ...current, name: event.target.value })); }} />
        </div>
        <div className="k-field k-field--full">
          <label htmlFor="store-description">Descrição pública</label>
          <textarea id="store-description" value={draft.description ?? ""} maxLength={1000} onChange={(event) => { setDraft((current) => ({ ...current, description: event.target.value })); }} placeholder="Conte um pouco sobre a loja." />
        </div>
        <div className="k-field">
          <label htmlFor="store-phone">Telefone público</label>
          <input id="store-phone" value={draft.phone ?? ""} maxLength={30} onChange={(event) => { setDraft((current) => ({ ...current, phone: event.target.value })); }} placeholder="(62) 99999-9999" />
        </div>
        <div className="k-field">
          <label htmlFor="store-email">E-mail público</label>
          <input id="store-email" type="email" value={draft.publicEmail ?? ""} maxLength={254} onChange={(event) => { setDraft((current) => ({ ...current, publicEmail: event.target.value })); }} placeholder="contato@sualoja.com.br" />
        </div>
        <div className="k-field k-field--full">
          <label htmlFor="store-address">Endereço / informação de localização</label>
          <textarea id="store-address" value={draft.address ?? ""} maxLength={500} onChange={(event) => { setDraft((current) => ({ ...current, address: event.target.value })); }} placeholder="Endereço ou referência que pode aparecer no catálogo." />
        </div>
        <div className="k-field">
          <label htmlFor="store-instagram">Instagram</label>
          <input id="store-instagram" value={draft.instagram ?? ""} maxLength={31} pattern="@?[A-Za-z0-9._]{1,30}" onChange={(event) => { setDraft((current) => ({ ...current, instagram: event.target.value })); }} placeholder="@sualoja" />
        </div>
      </div>
      <div className="k-actions">
        {status ? <span className="k-status" role="status">{status}</span> : null}
        <button className="k-button k-button--primary" type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar informações"}</button>
      </div>
    </form>
  );
}
