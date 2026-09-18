import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { MasterWhiteLabelDetail } from "../../lib/server/master-white-label.types.ts";
import { changeMasterWhiteLabelOwner, setMasterWhiteLabelStatus, updateMasterWhiteLabel } from "../../lib/server/master-white-label.functions.ts";

function formText(form: FormData, key: string, fallback = ""): string {
  const value = form.get(key);
  return typeof value === "string" ? value : fallback;
}

export function MasterWhiteLabelDetailForm({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const parsed: unknown = JSON.parse(formText(form, "settings", "{}"));
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Settings deve ser um objeto JSON.");
      await updateMasterWhiteLabel({
        data: {
          tenantId: detail.tenant.id,
          name: formText(form, "name"),
          slug: formText(form, "slug"),
          logoUrl: formText(form, "logoUrl").trim() || null,
          primaryColor: formText(form, "primaryColor").trim() || null,
          settings: parsed as Record<string, unknown>,
        },
      });
      setMessage("White Label atualizada.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar.");
    } finally {
      setBusy(false);
    }
  }

  async function owner(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      await changeMasterWhiteLabelOwner({ data: { tenantId: detail.tenant.id, ownerUserId: formText(form, "ownerUserId") } });
      setMessage("Owner atualizado.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao trocar owner.");
    } finally {
      setBusy(false);
    }
  }

  async function status(next: "active" | "suspended"): Promise<void> {
    setBusy(true);
    setMessage("");
    try {
      await setMasterWhiteLabelStatus({ data: { tenantId: detail.tenant.id, status: next } });
      setMessage(next === "suspended" ? "White Label suspensa." : "White Label reativada.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao alterar status.");
    } finally {
      setBusy(false);
    }
  }

  const currentOwner = detail.members.find((member) => member.role === "tenant_owner");
  return <><form className="master-card master-panel" onSubmit={(event) => { void save(event); }}><h2>Dados gerais</h2><div className="k-form__grid"><div className="k-field"><label htmlFor="detail-name">Nome</label><input id="detail-name" name="name" defaultValue={detail.tenant.name} required/></div><div className="k-field"><label htmlFor="detail-slug">Slug</label><input id="detail-slug" name="slug" defaultValue={detail.tenant.slug} required/></div><div className="k-field"><label htmlFor="detail-logo">Logo URL</label><input id="detail-logo" name="logoUrl" defaultValue={detail.tenant.logoUrl ?? ""}/></div><div className="k-field"><label htmlFor="detail-color">Cor primária</label><input id="detail-color" name="primaryColor" defaultValue={detail.tenant.primaryColor ?? ""} placeholder="#112233"/></div><div className="k-field k-field--full"><label htmlFor="detail-settings">Settings JSON</label><textarea id="detail-settings" name="settings" rows={8} defaultValue={JSON.stringify(detail.tenant.settings, null, 2)}/></div></div><div className="k-actions"><button className="k-button k-button--primary" disabled={busy}>Salvar</button></div></form><form className="master-card master-panel" onSubmit={(event) => { void owner(event); }}><h2>Owner</h2><p className="k-muted">Atual: {currentOwner?.email ?? currentOwner?.userId ?? "Sem owner"}</p><div className="k-field"><label htmlFor="owner-id">Novo user ID</label><input id="owner-id" name="ownerUserId" required/></div><div className="k-actions"><button className="k-button" disabled={busy}>Trocar owner</button></div></form><section className="master-card master-panel"><h2>Status</h2><p>Status atual: <strong>{detail.tenant.status}</strong></p><div className="k-actions"><button className="k-button" disabled={busy || detail.tenant.status === "active"} onClick={() => { void status("active"); }}>Reativar</button><button className="k-button" disabled={busy || detail.tenant.status === "suspended"} onClick={() => { void status("suspended"); }}>Suspender</button></div></section>{message ? <div className="k-status">{message}</div> : null}</>;
}
