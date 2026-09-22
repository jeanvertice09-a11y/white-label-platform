import { useState } from "react";
import type { CSSProperties, SyntheticEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  getCatalogAdvancedSettings,
  getCatalogBehavior,
  mergeCatalogAdvancedSettingsLabels,
  setCatalogBehaviorFlag,
} from "@white-label/catalog";
import type {
  CatalogAdvancedSettings,
  CatalogBehaviorFlag,
  CatalogSettings,
  CatalogSettingsMutationInput,
} from "@white-label/catalog";
import { saveMerchantCatalogSettings } from "../../lib/server/catalog-admin.functions.ts";

type SettingsDraft = CatalogSettingsMutationInput;
type Setter = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => void;

function initialDraft(settings: CatalogSettings): SettingsDraft {
  const { tenantId: _tenantId, storeId: _storeId, ...draft } = settings;
  return draft;
}

function AppearanceFields({ draft, setField }: Readonly<{ draft: SettingsDraft; setField: Setter }>): React.JSX.Element {
  return <>
    <div className="k-field"><label>Layout</label><select value={draft.layout} onChange={(e) => { setField("layout", e.target.value as SettingsDraft["layout"]); }}><option value="classic">Clássico</option><option value="modern">Moderno</option></select></div>
    <div className="k-field"><label>Fonte</label><select value={draft.fontFamily} onChange={(e) => { setField("fontFamily", e.target.value as SettingsDraft["fontFamily"]); }}><option value="system">Sistema</option><option value="inter">Inter</option><option value="sans">Sem serifa</option><option value="serif">Com serifa</option></select></div>
    <div className="k-field"><label>Cor principal</label><input type="color" value={draft.primaryColor} onChange={(e) => { setField("primaryColor", e.target.value); }} /></div>
    <div className="k-field"><label>Cor de destaque</label><input type="color" value={draft.accentColor} onChange={(e) => { setField("accentColor", e.target.value); }} /></div>
    <div className="k-field"><label>Fundo</label><input type="color" value={draft.backgroundColor} onChange={(e) => { setField("backgroundColor", e.target.value); }} /></div>
  </>;
}

const BEHAVIOR_OPTIONS: ReadonlyArray<readonly [CatalogBehaviorFlag, string]> = [
  ["showDescription", "Mostrar descrição do produto"], ["showSku", "Mostrar SKU/código do produto"],
  ["showShare", "Mostrar compartilhamento"], ["showRelated", "Mostrar produtos relacionados"],
  ["cartEnabled", "Ativar carrinho"], ["showBuyButton", "Permitir adicionar ao carrinho"],
  ["quantityEnabled", "Permitir escolher quantidade"], ["persistCart", "Manter carrinho neste navegador"],
  ["showWhatsapp", "Disponibilizar finalização pelo WhatsApp"], ["catalogOnly", "Catálogo somente vitrine (sem compra)"],
];

function AdvancedFields({ draft, setField }: Readonly<{ draft: SettingsDraft; setField: Setter }>): React.JSX.Element {
  const advanced = getCatalogAdvancedSettings(draft);
  function setAdvanced(next: CatalogAdvancedSettings): void {
    setField("labels", mergeCatalogAdvancedSettingsLabels(draft.labels, next));
  }
  function toggle(key: keyof Pick<CatalogAdvancedSettings, "showOutOfStock" | "searchSuggestions" | "checkoutAskName" | "checkoutAskPhone" | "checkoutAskNotes">, value: boolean): void {
    setAdvanced({ ...advanced, [key]: value });
  }
  return <>
    <div className="k-field k-field--full"><strong>Catálogo avançado</strong><p className="k-muted">Preferências de listagem e checkout. Estoque, preço e pedido mínimo são revalidados no servidor.</p></div>
    <label className="k-check"><input type="checkbox" checked={advanced.showOutOfStock} onChange={(e) => { toggle("showOutOfStock", e.target.checked); }} />Exibir produtos sem estoque</label>
    <label className="k-check"><input type="checkbox" checked={advanced.searchSuggestions} onChange={(e) => { toggle("searchSuggestions", e.target.checked); }} />Mostrar sugestões na busca</label>
    <label className="k-check"><input type="checkbox" checked={advanced.checkoutAskName} onChange={(e) => { toggle("checkoutAskName", e.target.checked); }} />Pedir nome no checkout</label>
    <label className="k-check"><input type="checkbox" checked={advanced.checkoutAskPhone} onChange={(e) => { toggle("checkoutAskPhone", e.target.checked); }} />Pedir telefone no checkout</label>
    <label className="k-check"><input type="checkbox" checked={advanced.checkoutAskNotes} onChange={(e) => { toggle("checkoutAskNotes", e.target.checked); }} />Pedir observação no checkout</label>
    <div className="k-field"><label>Pedido mínimo (R$)</label><input type="number" min="0" max="1000000" step="0.01" value={(advanced.minimumOrderCents / 100).toFixed(2)} onChange={(e) => { const value = Number(e.target.value); setAdvanced({ ...advanced, minimumOrderCents: Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : 0 }); }} /></div>
    <div className="k-field"><label>Produtos por linha</label><select value={advanced.productsPerRow} onChange={(e) => { const value = Number(e.target.value); setAdvanced({ ...advanced, productsPerRow: value === 2 || value === 3 ? value : 4 }); }}><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></div>
    <div className="k-field"><label>Estilo do card</label><select value={advanced.cardStyle} onChange={(e) => { setAdvanced({ ...advanced, cardStyle: e.target.value === "compact" ? "compact" : "default" }); }}><option value="default">Padrão</option><option value="compact">Compacto</option></select></div>
  </>;
}

function CatalogFields({ draft, setField }: Readonly<{ draft: SettingsDraft; setField: Setter }>): React.JSX.Element {
  const behavior = getCatalogBehavior(draft);
  const setBehavior = (flag: CatalogBehaviorFlag, enabled: boolean) => { setField("labels", setCatalogBehaviorFlag(draft.labels, flag, enabled)); };
  return <>
    <div className="k-field k-field--full"><label>Subtítulo da loja</label><input value={draft.labels["subtitle"] ?? ""} maxLength={120} onChange={(e) => { setField("labels", { ...draft.labels, subtitle: e.target.value }); }} placeholder="Catálogo online" /></div>
    <div className="k-field"><label>Finalização do pedido</label><select value={draft.checkoutMode} onChange={(e) => { setField("checkoutMode", e.target.value as SettingsDraft["checkoutMode"]); }}><option value="whatsapp">WhatsApp</option><option value="online">Online (em preparação)</option><option value="both">WhatsApp + Online</option></select></div>
    <div className="k-field"><label>WhatsApp</label><input value={draft.whatsappPhone ?? ""} onChange={(e) => { setField("whatsappPhone", e.target.value || null); }} placeholder="5562999999999" /></div>
    <div className="k-field k-field--full"><label>Mensagem padrão do WhatsApp</label><textarea value={draft.whatsappMessage} onChange={(e) => { setField("whatsappMessage", e.target.value); }} /></div>
    <div className="k-field"><label>Título nos buscadores</label><input value={draft.seoTitle ?? ""} onChange={(e) => { setField("seoTitle", e.target.value || null); }} /></div>
    <div className="k-field"><label>Descrição nos buscadores</label><input value={draft.seoDescription ?? ""} onChange={(e) => { setField("seoDescription", e.target.value || null); }} /></div>
    <div className="k-field k-field--full"><strong>Exibição e compra</strong><p className="k-muted">Preço, estoque, desconto e permissões continuam validados no servidor.</p></div>
    <label className="k-check"><input type="checkbox" checked={draft.showSearch} onChange={(e) => { setField("showSearch", e.target.checked); }} />Mostrar busca</label>
    <label className="k-check"><input type="checkbox" checked={draft.showCategories} onChange={(e) => { setField("showCategories", e.target.checked); }} />Mostrar categorias</label>
    <label className="k-check"><input type="checkbox" checked={draft.showPrice} onChange={(e) => { setField("showPrice", e.target.checked); }} />Mostrar preços</label>
    <label className="k-check"><input type="checkbox" checked={draft.showStock} onChange={(e) => { setField("showStock", e.target.checked); }} />Mostrar estoque</label>
    {BEHAVIOR_OPTIONS.map(([flag, label]) => <label className="k-check" key={flag}><input type="checkbox" checked={behavior[flag]} onChange={(e) => { setBehavior(flag, e.target.checked); }} />{label}</label>)}
    <AdvancedFields draft={draft} setField={setField} />
  </>;
}

function Preview({ draft }: Readonly<{ draft: SettingsDraft }>): React.JSX.Element {
  const style = { "--preview-primary": draft.primaryColor, "--preview-accent": draft.accentColor, "--preview-bg": draft.backgroundColor } as CSSProperties;
  const advanced = getCatalogAdvancedSettings(draft);
  return <div className="k-preview" style={style}><div className="k-preview__bar" /><div className="k-preview__body"><strong>Prévia {draft.layout === "modern" ? "Moderno" : "Clássico"}</strong><p className="k-muted">{draft.labels["subtitle"] || "Catálogo online"}</p><span className="k-preview__accent">{advanced.productsPerRow} por linha · card {advanced.cardStyle === "compact" ? "compacto" : "padrão"}</span></div></div>;
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
  return <form className="k-form" onSubmit={(event) => { void submit(event); }}><div className="k-card k-form__grid"><AppearanceFields draft={draft} setField={setField} /><CatalogFields draft={draft} setField={setField} /></div><Preview draft={draft} /><div className="k-actions">{status ? <span className="k-status" role="status">{status}</span> : null}<button className="k-button k-button--primary" type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar configurações"}</button></div></form>;
}
