import { useState } from "react";
import type { FormEvent } from "react";
import type { CatalogSettings } from "@white-label/catalog";
import { saveMerchantCatalogSettings } from "../../lib/server/catalog-admin.functions.ts";
import { buttonStyle, Card, Field, gridStyle, inputStyle } from "./ui.tsx";

export function CatalogSettingsForm(props: {
  settings: CatalogSettings;
  mode?: "catalog" | "appearance";
}): React.JSX.Element {
  const [status, setStatus] = useState("");
  const settings = props.settings;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("Salvando...");
    try {
      await saveMerchantCatalogSettings({
        data: {
          layout: form.get("layout") === "modern" ? "modern" : "classic",
          primaryColor: String(form.get("primaryColor") ?? ""),
          accentColor: String(form.get("accentColor") ?? ""),
          backgroundColor: String(form.get("backgroundColor") ?? ""),
          fontFamily: String(form.get("fontFamily") ?? "system") as CatalogSettings["fontFamily"],
          showSearch: form.get("showSearch") === "on",
          showCategories: form.get("showCategories") === "on",
          showPrice: form.get("showPrice") === "on",
          showStock: form.get("showStock") === "on",
          labels: settings.labels,
          whatsappPhone: String(form.get("whatsappPhone") ?? "").trim() || null,
          whatsappMessage: String(form.get("whatsappMessage") ?? "").trim(),
          checkoutMode: String(form.get("checkoutMode") ?? "whatsapp") as CatalogSettings["checkoutMode"],
          seoTitle: String(form.get("seoTitle") ?? "").trim() || null,
          seoDescription: String(form.get("seoDescription") ?? "").trim() || null,
        },
      });
      setStatus("Configurações salvas.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao salvar configurações.");
    }
  }

  return (
    <Card>
      <form onSubmit={(event) => { void submit(event); }} style={{ display: "grid", gap: 18 }}>
        <div style={gridStyle}>
          <Field label="Layout">
            <select style={inputStyle} name="layout" defaultValue={settings.layout}>
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
            </select>
          </Field>
          <Field label="Fonte">
            <select style={inputStyle} name="fontFamily" defaultValue={settings.fontFamily}>
              <option value="system">Sistema</option>
              <option value="inter">Inter</option>
              <option value="sans">Sans</option>
              <option value="serif">Serif</option>
            </select>
          </Field>
          <Field label="Cor principal">
            <input style={inputStyle} name="primaryColor" type="color" defaultValue={settings.primaryColor} />
          </Field>
          <Field label="Cor de destaque">
            <input style={inputStyle} name="accentColor" type="color" defaultValue={settings.accentColor} />
          </Field>
          <Field label="Fundo">
            <input style={inputStyle} name="backgroundColor" type="color" defaultValue={settings.backgroundColor} />
          </Field>
        </div>

        {props.mode !== "appearance" ? (
          <>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <label><input name="showSearch" type="checkbox" defaultChecked={settings.showSearch} /> Mostrar busca</label>
              <label><input name="showCategories" type="checkbox" defaultChecked={settings.showCategories} /> Mostrar categorias</label>
              <label><input name="showPrice" type="checkbox" defaultChecked={settings.showPrice} /> Mostrar preço</label>
              <label><input name="showStock" type="checkbox" defaultChecked={settings.showStock} /> Mostrar estoque</label>
            </div>
            <div style={gridStyle}>
              <Field label="WhatsApp">
                <input style={inputStyle} name="whatsappPhone" defaultValue={settings.whatsappPhone ?? ""} placeholder="5562999990000" />
              </Field>
              <Field label="Checkout">
                <select style={inputStyle} name="checkoutMode" defaultValue={settings.checkoutMode}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="online">Online (futuro)</option>
                  <option value="both">Ambos</option>
                </select>
              </Field>
            </div>
            <Field label="Mensagem padrão do WhatsApp">
              <textarea style={{ ...inputStyle, minHeight: 90 }} name="whatsappMessage" defaultValue={settings.whatsappMessage} />
            </Field>
            <div style={gridStyle}>
              <Field label="SEO title">
                <input style={inputStyle} name="seoTitle" defaultValue={settings.seoTitle ?? ""} />
              </Field>
              <Field label="SEO description">
                <input style={inputStyle} name="seoDescription" defaultValue={settings.seoDescription ?? ""} />
              </Field>
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="showSearch" value={settings.showSearch ? "on" : ""} />
            <input type="hidden" name="showCategories" value={settings.showCategories ? "on" : ""} />
            <input type="hidden" name="showPrice" value={settings.showPrice ? "on" : ""} />
            <input type="hidden" name="showStock" value={settings.showStock ? "on" : ""} />
            <input type="hidden" name="whatsappPhone" value={settings.whatsappPhone ?? ""} />
            <input type="hidden" name="whatsappMessage" value={settings.whatsappMessage} />
            <input type="hidden" name="checkoutMode" value={settings.checkoutMode} />
            <input type="hidden" name="seoTitle" value={settings.seoTitle ?? ""} />
            <input type="hidden" name="seoDescription" value={settings.seoDescription ?? ""} />
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={buttonStyle} type="submit">Salvar configurações</button>
          <span style={{ color: "#6b7280", fontSize: 14 }}>{status}</span>
        </div>
      </form>
    </Card>
  );
}
