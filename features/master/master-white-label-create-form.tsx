import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { createMasterWhiteLabel } from "../../lib/server/master-white-label.functions.ts";

function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function MasterWhiteLabelCreateForm(): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const result = await createMasterWhiteLabel({
        data: {
          name: formText(form, "name"),
          slug: formText(form, "slug"),
          ownerUserId: formText(form, "ownerUserId"),
        },
      });
      setMessage(result.created ? "White Label criada." : "White Label já existia; nenhuma duplicação criada.");
      event.currentTarget.reset();
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="master-editorial-form" onSubmit={(event) => { void submit(event); }}>
      <div className="master-editorial-form__heading">
        <h2>Nova White Label</h2>
        <p>Crie a plataforma e associe o responsável sem sair da visão operacional.</p>
      </div>
      <div className="k-form__grid">
        <div className="k-field"><label htmlFor="wl-name">Nome</label><input id="wl-name" name="name" required minLength={2}/></div>
        <div className="k-field"><label htmlFor="wl-slug">Slug</label><input id="wl-slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*"/></div>
        <div className="k-field k-field--full"><label htmlFor="wl-owner">User ID do owner (Supabase Auth)</label><input id="wl-owner" name="ownerUserId" required/></div>
      </div>
      {message ? <div className="k-status">{message}</div> : null}
      <div className="k-actions"><button className="k-button k-button--primary" disabled={busy} type="submit">Criar White Label</button></div>
    </form>
  );
}
