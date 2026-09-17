import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { StoreBanner } from "@white-label/catalog";
import { getCatalogPublicMediaUrl } from "@white-label/catalog";
import {
  createMerchantBanner,
  updateMerchantBanner,
} from "../../lib/server/catalog-admin.functions.ts";

function BannerRow({ banner }: Readonly<{ banner: StoreBanner }>) {
  const router = useRouter();
  const [active, setActive] = useState(banner.active);
  const [saving, setSaving] = useState(false);
  const imageUrl = getCatalogPublicMediaUrl(banner, banner.imageObjectKey);

  async function toggle(): Promise<void> {
    setSaving(true);
    try {
      await updateMerchantBanner({
        data: {
          id: banner.id,
          input: {
            title: banner.title,
            altText: banner.altText,
            imageObjectKey: banner.imageObjectKey,
            href: banner.href,
            active: !active,
            position: banner.position,
          },
        },
      });
      setActive(!active);
      await router.invalidate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="k-card k-row">
      <div className="k-row" style={{ justifyContent: "flex-start" }}>
        <img src={imageUrl} alt={banner.altText ?? ""} width="88" height="52" style={{ objectFit: "cover", borderRadius: 8 }} />
        <div className="k-row__main">
          <div className="k-row__title">{banner.title || "Banner sem título"}</div>
          <div className="k-row__meta">{active ? "Ativo" : "Inativo"}</div>
        </div>
      </div>
      <button className="k-button" type="button" onClick={() => void toggle()} disabled={saving}>
        {active ? "Desativar" : "Ativar"}
      </button>
    </div>
  );
}

export function BannerManager({ banners }: Readonly<{ banners: StoreBanner[] }>) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [objectKey, setObjectKey] = useState("");
  const [href, setHref] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      await createMerchantBanner({
        data: {
          title: title.trim() || null,
          altText: title.trim() || null,
          imageObjectKey: objectKey.trim(),
          href: href.trim() || null,
          active: true,
          position: banners.length,
        },
      });
      setTitle("");
      setObjectKey("");
      setHref("");
      setStatus("Banner criado.");
      await router.invalidate();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível criar o banner.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="k-page">
      <form className="k-card k-form" onSubmit={(event) => void submit(event)}>
        <div className="k-form__grid">
          <div className="k-field">
            <label>Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="k-field">
            <label>Link</label>
            <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://..." />
          </div>
          <div className="k-field k-field--full">
            <label>Chave da imagem no R2</label>
            <input value={objectKey} onChange={(e) => setObjectKey(e.target.value)} placeholder="tenants/.../stores/.../banner/..." required />
            <span className="k-row__meta">A chave precisa pertencer à loja atual; outro prefixo é bloqueado.</span>
          </div>
        </div>
        <div className="k-actions">
          {status ? <span className="k-status">{status}</span> : null}
          <button className="k-button" type="submit" disabled={saving}>{saving ? "Salvando…" : "Adicionar banner"}</button>
        </div>
      </form>
      {banners.length ? banners.map((banner) => <BannerRow key={banner.id} banner={banner} />) : <div className="k-empty">Nenhum banner cadastrado.</div>}
    </div>
  );
}
