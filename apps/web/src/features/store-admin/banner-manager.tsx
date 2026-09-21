import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { StoreBanner } from "@white-label/catalog";
import { getCatalogPublicMediaUrl } from "@white-label/catalog";
import { createMerchantBanner, updateMerchantBanner } from "../../lib/server/catalog-admin.functions.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";

type BannerForm = {
  title: string;
  altText: string;
  objectKey: string;
  href: string;
  position: string;
  active: boolean;
};

function emptyForm(position: number): BannerForm {
  return { title: "", altText: "", objectKey: "", href: "", position: String(position), active: true };
}

function fromBanner(banner: StoreBanner): BannerForm {
  return {
    title: banner.title ?? "",
    altText: banner.altText ?? "",
    objectKey: banner.imageObjectKey,
    href: banner.href ?? "",
    position: String(banner.position),
    active: banner.active,
  };
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function BannerRow(props: Readonly<{
  banner: StoreBanner;
  busy: boolean;
  onEdit: (banner: StoreBanner) => void;
  onToggle: (banner: StoreBanner) => Promise<void>;
}>): React.JSX.Element {
  const imageUrl = getCatalogPublicMediaUrl(props.banner, props.banner.imageObjectKey);
  return <article className="k-card">
    <div className="k-row" style={{ alignItems: "flex-start" }}>
      <img src={imageUrl} alt={props.banner.altText ?? ""} width="120" height="72" style={{ objectFit: "cover", borderRadius: 8 }} />
      <div className="k-row__main">
        <div className="k-row__title">{props.banner.title || "Banner sem título"}</div>
        <div className="k-row__meta">Ordem {props.banner.position} · {props.banner.active ? "Ativo" : "Arquivado"}</div>
        {props.banner.href ? <div className="k-row__meta">Destino: {props.banner.href}</div> : null}
        <div className="k-actions">
          <button className="k-button" type="button" disabled={props.busy} onClick={() => { props.onEdit(props.banner); }}>Editar</button>
          <button className="k-button" type="button" disabled={props.busy} onClick={() => { void props.onToggle(props.banner); }}>{props.banner.active ? "Arquivar" : "Reativar"}</button>
        </div>
      </div>
    </div>
  </article>;
}

export function BannerManager({ banners }: Readonly<{ banners: StoreBanner[] }>): React.JSX.Element {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(() => emptyForm(banners.length));
  const [status, setStatus] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  function reset(): void { setEditingId(null); setForm(emptyForm(banners.length)); }
  function edit(banner: StoreBanner): void { setEditingId(banner.id); setForm(fromBanner(banner)); setStatus(""); setError(""); }
  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setSaving(true); setStatus(""); setError("");
    const input = { title: form.title.trim() || null, altText: form.altText.trim() || null, imageObjectKey: form.objectKey.trim(), href: form.href.trim() || null, active: form.active, position: Number(form.position) };
    try {
      if (editingId) await updateMerchantBanner({ data: { id: editingId, input } }); else await createMerchantBanner({ data: input });
      setStatus(editingId ? "Banner atualizado." : "Banner criado."); reset(); await router.invalidate();
    } catch (cause) { setError(messageFrom(cause, "Não foi possível salvar o banner.")); }
    finally { setSaving(false); }
  }
  async function toggle(banner: StoreBanner): Promise<void> {
    if (banner.active && !confirmDangerousAction("Arquivar este banner? Ele deixará de aparecer no catálogo público.")) return;
    setSaving(true); setStatus(""); setError("");
    try {
      await updateMerchantBanner({ data: { id: banner.id, input: { title: banner.title, altText: banner.altText, imageObjectKey: banner.imageObjectKey, href: banner.href, active: !banner.active, position: banner.position } } });
      setStatus(banner.active ? "Banner arquivado." : "Banner reativado."); await router.invalidate();
    } catch (cause) { setError(messageFrom(cause, "Não foi possível alterar o banner.")); }
    finally { setSaving(false); }
  }
  return <div className="k-stack">
    <section className="k-card">
      <div className="k-row"><div><h2>{editingId ? "Editar banner" : "Novo banner"}</h2><p className="k-muted">Gerencie conteúdo, ordem e visibilidade usando mídia já armazenada para esta loja.</p></div>{editingId ? <button className="k-button" type="button" disabled={saving} onClick={reset}>Cancelar edição</button> : null}</div>
      <form className="k-form" onSubmit={(event) => { void submit(event); }}><div className="k-form__grid">
        <label className="k-field"><span>Título</span><input maxLength={160} value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); }} /></label><label className="k-field"><span>Texto alternativo</span><input maxLength={240} value={form.altText} onChange={(e) => { setForm({ ...form, altText: e.target.value }); }} /></label>
        <label className="k-field"><span>Link</span><input value={form.href} onChange={(e) => { setForm({ ...form, href: e.target.value }); }} placeholder="https://..." /></label><label className="k-field"><span>Ordem</span><input type="number" min={0} max={1000000} value={form.position} onChange={(e) => { setForm({ ...form, position: e.target.value }); }} /></label>
        <label className="k-field"><span>Status</span><select value={form.active ? "active" : "inactive"} onChange={(e) => { setForm({ ...form, active: e.target.value === "active" }); }}><option value="active">Ativo</option><option value="inactive">Arquivado</option></select></label>
        <label className="k-field k-field--full"><span>Chave da imagem</span><input required maxLength={1024} value={form.objectKey} onChange={(e) => { setForm({ ...form, objectKey: e.target.value }); }} placeholder="tenants/.../stores/.../banner/..." /><small>Use uma imagem já enviada à mídia desta loja. Upload direto ainda não está disponível.</small></label>
      </div>{error ? <div className="k-inline-state k-inline-state--error"><strong>Erro</strong><span>{error}</span></div> : null}{status ? <div className="k-inline-state"><strong>Concluído</strong><span>{status}</span></div> : null}<div className="k-actions"><button className="k-button k-button--primary" type="submit" disabled={saving}>{saving ? "Salvando…" : editingId ? "Salvar alterações" : "Adicionar banner"}</button></div></form>
    </section>
    <section className="k-workspace-section"><div className="k-section-head"><div><h2>Banners</h2><p>{banners.length} banner(es) cadastrados. Arquivar preserva o histórico sem excluir o registro.</p></div></div>{banners.length ? <div className="k-stack">{banners.map((banner) => <BannerRow key={banner.id} banner={banner} busy={saving} onEdit={edit} onToggle={toggle} />)}</div> : <div className="k-empty"><strong>Nenhum banner cadastrado</strong><span>Adicione um banner usando uma imagem já disponível para esta loja.</span></div>}</section>
  </div>;
}
