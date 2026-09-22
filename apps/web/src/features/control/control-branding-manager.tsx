import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { updateControlBrandingAction } from "../../lib/server/control-branding.functions.ts";
import { applyControlLogoAssetAction, removeControlLogoAction } from "../../lib/server/control-media.functions.ts";
import { discardUploadedControlLogo, uploadControlLogo } from "../../lib/media-upload.client.ts";
import type { TenantControlDashboardData } from "../../lib/server/platform-console.types.ts";

type Tenant = TenantControlDashboardData["tenant"];

function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function ControlBrandingManager({ initial }: Readonly<{ initial: Tenant }>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl ?? null);
  async function save(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      await updateControlBrandingAction({ data: {
        name: formText(form, "name"),
        primaryColor: formText(form, "primaryColor"),
      } });
      setMessage("Branding atualizado.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar branding.");
    } finally { setBusy(false); }
  }
  async function uploadLogo(file: File | undefined): Promise<void> {
    if (!file) return;
    setBusy(true); setMessage("Enviando logo…");
    let assetId: string | null = null;
    try {
      const asset = await uploadControlLogo(file);
      assetId = asset.id;
      const result = await applyControlLogoAssetAction({ data: { assetId: asset.id } });
      setLogoUrl(result.logoUrl);
      setMessage("Logo atualizado.");
      await router.invalidate();
    } catch (error) {
      if (assetId) { try { await discardUploadedControlLogo(assetId); } catch { /* cleanup server-side */ } }
      setMessage(error instanceof Error ? error.message : "Falha ao enviar o logo.");
    } finally { setBusy(false); }
  }
  async function removeLogo(): Promise<void> {
    setBusy(true); setMessage("");
    try {
      await removeControlLogoAction({ data: {} });
      setLogoUrl(null); setMessage("Logo removido.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao remover o logo.");
    } finally { setBusy(false); }
  }
  return <section className="control-section" id="branding-management">
    <div className="control-section__head"><div><span className="control-kicker">Identidade</span><h2>Configurar branding</h2><p>Nome, cor e logo da White Label. O logo é enviado ao storage seguro do tenant.</p></div></div>
    <form className="control-editorial-section" onSubmit={(event) => { void save(event); }}>
      <div className="k-form__grid"><div className="k-field"><label htmlFor="control-brand-name">Nome</label><input id="control-brand-name" name="name" defaultValue={initial.name} required maxLength={120} /></div><div className="k-field"><label htmlFor="control-brand-color">Cor primária</label><input id="control-brand-color" name="primaryColor" defaultValue={initial.primaryColor ?? ""} placeholder="#7B5EA7" /></div><div className="k-field k-field--full"><label htmlFor="control-brand-logo">Logo</label><input id="control-brand-logo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { void uploadLogo(event.target.files?.[0]); event.currentTarget.value = ""; }} /><small>JPG, PNG ou WebP, até 10 MB.</small></div></div>
      {logoUrl ? <div className="k-card" style={{ marginTop: 12 }}><img src={logoUrl} alt="Logo atual da White Label" style={{ display: "block", maxWidth: 260, maxHeight: 120, objectFit: "contain" }} /><div className="k-actions"><button className="k-button" type="button" disabled={busy} onClick={() => { void removeLogo(); }}>Remover logo</button></div></div> : null}
      <div className="k-actions"><button className="k-button k-button--primary" type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar branding"}</button></div>{message ? <div className="k-status" role="status">{message}</div> : null}
    </form>
  </section>;
}
