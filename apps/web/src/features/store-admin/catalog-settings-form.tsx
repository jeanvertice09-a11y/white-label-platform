import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { CatalogSettings } from "@white-label/catalog";
import { saveMerchantCatalogSettings } from "../../lib/server/catalog-admin.functions.ts";

export function CatalogSettingsForm({ settings }: Readonly<{ settings: CatalogSettings }>) {
  const router = useRouter();
  const [layout, setLayout] = useState(settings.layout);
  const [fontFamily, setFontFamily] = useState(settings.fontFamily);
  const [checkoutMode, setCheckoutMode] = useState(settings.checkoutMode);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [accentColor, setAccentColor] = useState(settings.accentColor);
  const [backgroundColor, setBackgroundColor] = useState(settings.backgroundColor);
  const [showSearch, setShowSearch] = useState(settings.showSearch);
  const [showCategories, setShowCategories] = useState(settings.showCategories);
  const [showPrice, setShowPrice] = useState(settings.showPrice);
  const [showStock, setShowStock] = useState(settings.showStock);
  const [phone, setPhone] = useState(settings.whatsappPhone ?? "");
  const [message, setMessage] = useState(settings.whatsappMessage);
  const [seoTitle, setSeoTitle] = useState(settings.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(settings.seoDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      await saveMerchantCatalogSettings({
        data: {
          layout,
          primaryColor,
          accentColor,
          backgroundColor,
          fontFamily,
          showSearch,
          showCategories,
          showPrice,
          showStock,
          labels: settings.labels,
          whatsappPhone: phone.trim() || null,
          whatsappMessage: message.trim(),
          checkoutMode,
          seoTitle: seoTitle.trim() || null,
          seoDescription: seoDescription.trim() || null,
        },
      });
      setStatus("Configurações salvas.");
      await router.invalidate();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const previewStyle = {
    "--preview-primary": primaryColor,
    "--preview-accent": accentColor,
    "--preview-bg": backgroundColor,
  } as CSSProperties;

  return (
    <form className="k-form" onSubmit={(event) => void submit(event)}>
      <div className="k-card k-form__grid">
        <div className="k-field">
          <label>Layout</label>
          <select value={layout} onChange={(e) => setLayout(e.target.value as "classic" | "modern")}>
            <option value="classic">Classic</option>
            <option value="modern">Modern</option>
          </select>
        </div>
        <div className="k-field">
          <label>Fonte</label>
          <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value as CatalogSettings["fontFamily"])}>
            <option value="system">Sistema</option><option value="inter">Inter</option>
            <option value="sans">Sans</option><option value="serif">Serif</option>
          </select>
        </div>
        <div className="k-field">
          <label>Modo de checkout</label>
          <select value={checkoutMode} onChange={(e) => setCheckoutMode(e.target.value as CatalogSettings["checkoutMode"])}>
            <option value="whatsapp">WhatsApp</option>
            <option value="online">Online (preparação)</option>
            <option value="both">WhatsApp + Online</option>
          </select>
        </div>
        <div className="k-field">
          <label>WhatsApp</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5562999999999" />
        </div>
        <div className="k-field"><label>Cor principal</label><input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} /></div>
        <div className="k-field"><label>Cor de destaque</label><input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} /></div>
        <div className="k-field"><label>Fundo</label><input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} /></div>
        <div className="k-field k-field--full"><label>Mensagem padrão do WhatsApp</label><textarea value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        <div className="k-field"><label>SEO title</label><input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} /></div>
        <div className="k-field"><label>SEO description</label><input value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} /></div>
        <label className="k-check"><input type="checkbox" checked={showSearch} onChange={(e) => setShowSearch(e.target.checked)} />Mostrar busca</label>
        <label className="k-check"><input type="checkbox" checked={showCategories} onChange={(e) => setShowCategories(e.target.checked)} />Mostrar categorias</label>
        <label className="k-check"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />Mostrar preços</label>
        <label className="k-check"><input type="checkbox" checked={showStock} onChange={(e) => setShowStock(e.target.checked)} />Mostrar estoque</label>
      </div>
      <div className="k-preview" style={previewStyle}>
        <div className="k-preview__bar" />
        <div className="k-preview__body">
          <strong>Prévia {layout === "modern" ? "Modern" : "Classic"}</strong>
          <p className="k-muted">Personalização estruturada, sem CSS ou JavaScript arbitrário.</p>
          <span className="k-preview__accent">Destaque da loja</span>
        </div>
      </div>
      <div className="k-actions">
        {status ? <span className="k-status">{status}</span> : null}
        <button className="k-button k-button--primary" type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar configurações"}
        </button>
      </div>
    </form>
  );
}
