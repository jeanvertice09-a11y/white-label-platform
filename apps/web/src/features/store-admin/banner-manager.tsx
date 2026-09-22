import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { StoreBanner } from "@white-label/catalog";
import { getCatalogPublicMediaUrl } from "@white-label/catalog";
import { saveUploadedBanner, removeUploadedBanner } from "../../lib/server/media-association.functions.ts";
import { discardUploadedMerchantMedia, uploadMerchantMedia } from "../../lib/media-upload.client.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";

type BannerForm = { title: string; altText: string; href: string; position: string; active: boolean };

function emptyForm(position: number): BannerForm {
  return { title: "", altText: "", href: "", position: String(position), active: true };
}
function fromBanner(banner: StoreBanner): BannerForm {
  return { title: banner.title ?? "", altText: banner.altText ?? "", href: banner.href ?? "", position: String(banner.position), active: banner.active };
}
function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function BannerRow(props: Readonly<{
  banner: StoreBanner; busy: boolean; onEdit: (banner: StoreBanner) => void;
  onToggle: (banner: StoreBanner) => Promise<void>; onRemove: (banner: StoreBanner) => Promise<void>;
}>): React.JSX.Element {
  const imageUrl = getCatalogPublicMediaUrl(props.banner, props.banner.imageObjectKey);
  return <article className="k-card"><div className="k-row" style={{ alignItems: "flex-start" }}>
    <img src={imageUrl} alt={props.banner.altText ?? ""} width="120" height="72" style={{ objectFit: "cover", borderRadius: 8 }} />
    <div className="k-row__main"><div className="k-row__title">{props.banner.title || "Banner sem título"}</div><div className="k-row__meta">Ordem {props.banner.position} · {props.banner.active ? "Ativo" : "Arquivado"}</div>{props.banner.href ? <div className="k-row__meta">Destino: {props.banner.href}</div> : null}
      <div className="k-actions"><button className="k-button" type="button" disabled={props.busy} onClick={() => { props.onEdit(props.banner); }}>Editar</button><button className="k-button" type="button" disabled={props.busy} onClick={() => { void props.onToggle(props.banner); }}>{props.banner.active ? "Arquivar" : "Reativar"}</button><button className="k-button" type="button" disabled={props.busy} onClick={() => { void props.onRemove(props.banner); }}>Remover</button></div>
    </div>
  </div></article>;
}

function useBannerManager(banners: StoreBanner[]) {
  const router = useRouter();
  const [editing, setEditing] = useState<StoreBanner | null>(null);
  const [form, setForm] = useState<BannerForm>(() => emptyForm(banners.length));
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => () => { if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  function chooseFile(next: File | null): void {
    setFile(next); setPreviewUrl(next ? URL.createObjectURL(next) : editing ? getCatalogPublicMediaUrl(editing, editing.imageObjectKey) : null);
  }
  function reset(): void { setEditing(null); setForm(emptyForm(banners.length)); setFile(null); setPreviewUrl(null); }
  function edit(banner: StoreBanner): void {
    setEditing(banner); setForm(fromBanner(banner)); setFile(null); setPreviewUrl(getCatalogPublicMediaUrl(banner, banner.imageObjectKey)); setStatus(""); setError("");
  }
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setSaving(true); setStatus(""); setError(""); let assetId: string | null = null;
    try {
      if (file) { const asset = await uploadMerchantMedia(file, "banner"); assetId = asset.id; }
      await saveUploadedBanner({ data: { ...(editing ? { id: editing.id } : {}), ...(assetId ? { assetId } : {}), title: form.title.trim() || null, altText: form.altText.trim() || null, href: form.href.trim() || null, active: form.active, position: Number(form.position) } });
      setStatus(editing ? "Banner atualizado." : "Banner criado."); reset(); await router.invalidate();
    } catch (cause) {
      if (assetId) { try { await discardUploadedMerchantMedia(assetId); } catch { /* cleanup server-side */ } }
      setError(messageFrom(cause, "Não foi possível salvar o banner."));
    } finally { setSaving(false); }
  }
  async function toggle(banner: StoreBanner): Promise<void> {
    if (banner.active && !confirmDangerousAction("Arquivar este banner? Ele deixará de aparecer no catálogo público.")) return;
    setSaving(true); setStatus(""); setError("");
    try { await saveUploadedBanner({ data: { id: banner.id, title: banner.title, altText: banner.altText, href: banner.href, active: !banner.active, position: banner.position } }); setStatus(banner.active ? "Banner arquivado." : "Banner reativado."); await router.invalidate(); }
    catch (cause) { setError(messageFrom(cause, "Não foi possível alterar o banner.")); } finally { setSaving(false); }
  }
  async function remove(banner: StoreBanner): Promise<void> {
    if (!confirmDangerousAction("Remover este banner? O arquivo será excluído se não estiver em uso.")) return;
    setSaving(true); setStatus(""); setError("");
    try { await removeUploadedBanner({ data: { id: banner.id } }); if (editing?.id === banner.id) reset(); setStatus("Banner removido."); await router.invalidate(); }
    catch (cause) { setError(messageFrom(cause, "Não foi possível remover o banner.")); } finally { setSaving(false); }
  }
  return { editing, form, setForm, previewUrl, status, error, saving, chooseFile, reset, edit, submit, toggle, remove };
}

export function BannerManager({ banners }: Readonly<{ banners: StoreBanner[] }>): React.JSX.Element {
  const manager = useBannerManager(banners);
  return <div className="k-stack">
    <section className="k-card">
      <div className="k-row"><div><h2>{manager.editing ? "Editar banner" : "Novo banner"}</h2><p className="k-muted">Envie a imagem diretamente para o storage seguro da loja.</p></div>{manager.editing ? <button className="k-button" type="button" disabled={manager.saving} onClick={manager.reset}>Cancelar edição</button> : null}</div>
      <form className="k-form" onSubmit={(event) => { void manager.submit(event); }}><div className="k-form__grid">
        <label className="k-field"><span>Título</span><input maxLength={160} value={manager.form.title} onChange={(event) => { manager.setForm({ ...manager.form, title: event.target.value }); }} /></label><label className="k-field"><span>Texto alternativo</span><input maxLength={240} value={manager.form.altText} onChange={(event) => { manager.setForm({ ...manager.form, altText: event.target.value }); }} /></label>
        <label className="k-field"><span>Link</span><input type="url" value={manager.form.href} onChange={(event) => { manager.setForm({ ...manager.form, href: event.target.value }); }} placeholder="https://..." /></label><label className="k-field"><span>Ordem</span><input type="number" min={0} max={1000000} value={manager.form.position} onChange={(event) => { manager.setForm({ ...manager.form, position: event.target.value }); }} /></label>
        <label className="k-field"><span>Status</span><select value={manager.form.active ? "active" : "inactive"} onChange={(event) => { manager.setForm({ ...manager.form, active: event.target.value === "active" }); }}><option value="active">Ativo</option><option value="inactive">Arquivado</option></select></label><label className="k-field k-field--full"><span>{manager.editing ? "Substituir imagem" : "Imagem"}</span><input type="file" required={!manager.editing} accept="image/jpeg,image/png,image/webp" disabled={manager.saving} onChange={(event) => { manager.chooseFile(event.target.files?.[0] ?? null); }} /><small>JPG, PNG ou WebP, até 10 MB.</small></label>
      </div>{manager.previewUrl ? <div className="k-card" style={{ marginTop: 12 }}><img src={manager.previewUrl} alt="Prévia do banner" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 8 }} /></div> : null}{manager.error ? <div className="k-inline-state k-inline-state--error"><strong>Erro</strong><span>{manager.error}</span></div> : null}{manager.status ? <div className="k-inline-state"><strong>Concluído</strong><span>{manager.status}</span></div> : null}<div className="k-actions"><button className="k-button k-button--primary" type="submit" disabled={manager.saving}>{manager.saving ? "Enviando…" : manager.editing ? "Salvar alterações" : "Adicionar banner"}</button></div></form>
    </section>
    <section className="k-workspace-section"><div className="k-section-head"><div><h2>Banners</h2><p>{banners.length} banner(es) cadastrado(s).</p></div></div>{banners.length ? <div className="k-stack">{banners.map((banner) => <BannerRow key={banner.id} banner={banner} busy={manager.saving} onEdit={manager.edit} onToggle={manager.toggle} onRemove={manager.remove} />)}</div> : <div className="k-empty"><strong>Nenhum banner cadastrado</strong><span>Envie a primeira imagem para criar um banner.</span></div>}</section>
  </div>;
}
