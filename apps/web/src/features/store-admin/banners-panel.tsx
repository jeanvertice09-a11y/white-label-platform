import { useState } from "react";
import type { FormEvent } from "react";
import type { StoreBanner } from "@white-label/catalog";
import {
  createMerchantBanner,
  updateMerchantBanner,
} from "../../lib/server/catalog-admin.functions.ts";
import { buttonStyle, Card, EmptyState, Field, gridStyle, inputStyle } from "./ui.tsx";

function BannerForm(props: { banner?: StoreBanner }): React.JSX.Element {
  const [status, setStatus] = useState("");
  const banner = props.banner;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("Salvando...");
    const input = {
      title: String(form.get("title") ?? "").trim() || null,
      altText: String(form.get("altText") ?? "").trim() || null,
      imageObjectKey: String(form.get("imageObjectKey") ?? "").trim(),
      href: String(form.get("href") ?? "").trim() || null,
      active: form.get("active") === "on",
      position: Number(form.get("position") ?? 0),
    };
    try {
      if (banner) {
        await updateMerchantBanner({ data: { id: banner.id, input } });
      } else {
        await createMerchantBanner({ data: input });
      }
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao salvar banner.");
    }
  }

  return (
    <form onSubmit={(event) => { void submit(event); }} style={{ display: "grid", gap: 12 }}>
      <div style={gridStyle}>
        <Field label="Título">
          <input style={inputStyle} name="title" defaultValue={banner?.title ?? ""} />
        </Field>
        <Field label="Texto alternativo">
          <input style={inputStyle} name="altText" defaultValue={banner?.altText ?? ""} />
        </Field>
        <Field label="Posição">
          <input style={inputStyle} name="position" type="number" min={0} defaultValue={banner?.position ?? 0} />
        </Field>
      </div>
      <Field label="Object key R2" hint="Precisa pertencer ao prefixo desta loja.">
        <input style={inputStyle} name="imageObjectKey" required defaultValue={banner?.imageObjectKey ?? ""} />
      </Field>
      <Field label="Link">
        <input style={inputStyle} name="href" type="url" defaultValue={banner?.href ?? ""} />
      </Field>
      <label><input name="active" type="checkbox" defaultChecked={banner?.active ?? true} /> Ativo</label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button style={buttonStyle} type="submit">{banner ? "Salvar banner" : "Criar banner"}</button>
        <span style={{ color: "#6b7280", fontSize: 13 }}>{status}</span>
      </div>
    </form>
  );
}

export function BannersPanel(props: { banners: StoreBanner[] }): React.JSX.Element {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card><h2 style={{ marginTop: 0 }}>Novo banner</h2><BannerForm /></Card>
      {props.banners.length === 0 ? (
        <Card><EmptyState title="Nenhum banner" text="Adicione um banner quando tiver um asset R2 da loja." /></Card>
      ) : props.banners.map((banner) => (
        <Card key={banner.id}><BannerForm banner={banner} /></Card>
      ))}
    </div>
  );
}
