import { useState } from "react";
import type { CSSProperties, SyntheticEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type {
  CatalogSettings,
  CatalogSettingsMutationInput,
} from "@white-label/catalog";
import { saveMerchantCatalogSettings } from "../../lib/server/catalog-admin.functions.ts";

type SettingsDraft = CatalogSettingsMutationInput;

function initialDraft(settings: CatalogSettings): SettingsDraft {
  return {
    layout: settings.layout,
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
    backgroundColor: settings.backgroundColor,
    fontFamily: settings.fontFamily,
    showSearch: settings.showSearch,
    showCategories: settings.showCategories,
    showPrice: settings.showPrice,
    showStock: settings.showStock,
    labels: settings.labels,
    whatsappPhone: settings.whatsappPhone,
    whatsappMessage: settings.whatsappMessage,
    checkoutMode: settings.checkoutMode,
    seoTitle: settings.seoTitle,
    seoDescription: settings.seoDescription,
  };
}

function AppearanceFields(props: Readonly<{
  draft: SettingsDraft;
  setField: <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => void;
}>): React.JSX.Element {
  const { draft, setField } = props;
  return <>
    <div className="k-field"><label>Layout</label><select value={draft.layout} onChange={(event) => { setField("layout", event.target.value as SettingsDraft["layout"]); }}><option value="classic">Classic</option><option value="modern">Modern</option></select></div>
    <div className="k-field"><label>Fonte</label><select value={draft.fontFamily} onChange={(event) => { setField("fontFamily", event.target.value as SettingsDraft["fontFamily"]); }}><option value="system">Sistema</option><option value="inter">Inter</option><option value="sans">Sans</option><option value="serif">Serif</option></select></div>
    <div className="k-field"><label>Cor principal</label><input type="color" value={draft.primaryColor} onChange={(event) => { setField("primaryColor", event.target.value); }} /></div>
    <div className="k-field"><label>Cor de destaque</label><input type="color" value={draft.accentColor} onChange={(event) => { setField("accentColor", event.target.value); }} /></div>
    <div className="k-field"><label>Fundo</label><input type="color" value={draft.backgroundColor} onChange={(event) => { setField("backgroundColor", event.target.value); }} /></div>
  </>;
}

function CatalogFields(props: Readonly<{
  draft: SettingsDraft;
  setField: <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => void;
}>): React.JSX.Element {
  const { draft, setField } = props;
  return <>
    <div className="k-field k-field--full"><label>Subtítulo da loja</label><input value={draft.labels["subtitle"] ?? ""} maxLength={120} onChange={(event) => { setField("labels", { ...draft.labels, subtitle: event.target.value }); }} placeholder="Catálogo online" /></div>
    <div className="k-field"><label>Modo de checkout</label><select value={draft.checkoutMode} onChange={(event) => { setField("checkoutMode", event.target.value as SettingsDraft["checkoutMode"]); }}><option value="whatsapp">WhatsApp</option><option value="online">Online (preparação)</option><option value="both">WhatsApp + Online</option></select></div>
    <div className="k-field"><label>WhatsApp</label><input value={draft.whatsappPhone ?? ""} onChange={(event) => { setField("whatsappPhone", event.target.value || null); }} placeholder="5562999999999" /></div>
    <div className="k-field k-field--full"><label>Mensagem padrão do WhatsApp</label><textarea value={draft.whatsappMessage} onChange={(event) => { setField("whatsappMessage", event.target.value); }} /></div>
    <div className="k-field"><label>SEO title</label><input value={draft.seoTitle ?? ""} onChange={(event) => { setField("seoTitle", event.target.value || null); }} /></div>
    <div className="k-field"><label>SEO description</label><input value={draft.seoDescription ?? ""} onChange={(event) => { setField("seoDescription", event.target.value || null); }} /></div>
    <label className="k-check"><input type="checkbox" checked={draft.showSearch} onChange={(event) => { setField("showSearch", event.target.checked); }} />Mostrar busca</label>
    <label className="k-check"><input type="checkbox" checked={draft.showCategories} onChange={(event) => { setField("showCategories", event.target.checked); }} />Mostrar categorias</label>
    <label className="k-check"><input type="checkbox" checked={draft.showPrice} onChange={(event) => { setField("showPrice", event.target.checked); }} />Mostrar preços</label>
    <label className="k-check"><input type="checkbox" checked={draft.showStock} onChange={(event) => { setField("showStock", event.target.checked); }} />Mostrar estoque</label>
  </>;
}

function Preview({ draft }: Readonly<{ draft: SettingsDraft }>): React.JSX.Element {
  const style = { "--preview-primary": draft.primaryColor, "--preview-accent": draft.accentColor, "--preview-bg": draft.backgroundColor } as CSSProperties;
  return <div className="k-preview" style={style}><div className="k-preview__bar" /><div className="k-preview__body"><strong>Prévia {draft.layout === "modern" ? "Modern" : "Classic"}</strong><p className="k-muted">{draft.labels["subtitle"] || "Catálogo online"}</p><span className="k-preview__accent">Destaque da loja</span></div></div>;
}

export function CatalogSettingsForm({ settings }: Readonly<{ settings: CatalogSettings }>): React.JSX.Element {
  const router = useRouter();
  const [draft, setDraft] = useState(() => initialDraft(settings));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  function setField<K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]): void { setDraft((current) => ({ ...current, [key]: value })); }
  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setSaving(true); setStatus("");
    try { await saveMerchantCatalogSettings({ data: draft }); setStatus("Configurações salvas."); await router.invalidate(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  return <form className="k-form" onSubmit={(event) => { void submit(event); }}><div className="k-card k-form__grid"><AppearanceFields draft={draft} setField={setField} /><CatalogFields draft={draft} setField={setField} /></div><Preview draft={draft} /><div className="k-actions">{status ? <span className="k-status">{status}</span> : null}<button className="k-button k-button--primary" type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar configurações"}</button></div></form>;
}
