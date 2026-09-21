import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { getCatalogPublicMediaUrl } from "@white-label/catalog";
import type { Product, ProductImage } from "@white-label/catalog";
import {
  createMerchantProductImage,
  removeMerchantProductImage,
  setMerchantPrimaryProductImage,
  updateMerchantProductImage,
} from "../../lib/server/catalog-admin.functions.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function ImageRow(props: Readonly<{ product: Product; image: ProductImage; primary: boolean; onSaved: () => Promise<void> }>): React.JSX.Element {
  const [altText, setAltText] = useState(props.image.altText ?? "");
  const [position, setPosition] = useState(String(props.image.position));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const imageUrl = getCatalogPublicMediaUrl(props.product, props.image.objectKey);
  async function action(operation: () => Promise<unknown>, success: string, fallback: string): Promise<void> {
    setSaving(true); setStatus("");
    try { await operation(); setStatus(success); await props.onSaved(); }
    catch (cause) { setStatus(messageFrom(cause, fallback)); }
    finally { setSaving(false); }
  }
  function save(): void {
    void action(() => updateMerchantProductImage({ data: { id: props.image.id, input: {
      productId: props.product.id, objectKey: props.image.objectKey, altText: altText.trim() || null, position: Number(position),
    } } }), "Imagem atualizada.", "Não foi possível atualizar a imagem.");
  }
  function makePrimary(): void {
    void action(() => setMerchantPrimaryProductImage({ data: { productId: props.product.id, id: props.image.id } }), "Imagem principal atualizada.", "Não foi possível alterar a imagem principal.");
  }
  function remove(): void {
    if (!confirmDangerousAction("Remover esta imagem do produto? O arquivo armazenado não será apagado.")) return;
    void action(() => removeMerchantProductImage({ data: { productId: props.product.id, id: props.image.id } }), "Imagem removida do produto.", "Não foi possível remover a imagem do produto.");
  }
  return <article className="k-card"><div className="k-row" style={{ alignItems: "flex-start" }}>
    <img src={imageUrl} alt={props.image.altText ?? props.product.name} width="112" height="112" style={{ objectFit: "cover", borderRadius: 10 }} />
    <div className="k-row__main"><div className="k-row__title">{props.primary ? "Imagem principal" : `Imagem ${String(props.image.position + 1)}`}</div><div className="k-row__meta">{props.image.objectKey}</div>
      <div className="k-form__grid" style={{ marginTop: 12 }}><label className="k-field"><span>Texto alternativo</span><input maxLength={240} value={altText} onChange={(e) => { setAltText(e.target.value); }} /></label><label className="k-field"><span>Ordem</span><input type="number" min={0} max={1000000} value={position} onChange={(e) => { setPosition(e.target.value); }} /></label></div>
      {status ? <div className="k-row__meta" style={{ marginTop: 8 }}>{status}</div> : null}
      <div className="k-actions"><button className="k-button" type="button" disabled={saving} onClick={save}>Salvar imagem</button>{!props.primary ? <button className="k-button" type="button" disabled={saving} onClick={makePrimary}>Tornar principal</button> : null}<button className="k-button" type="button" disabled={saving} onClick={remove}>Remover do produto</button></div>
    </div>
  </div></article>;
}

export function ProductImageManager({ product }: Readonly<{ product: Product }>): React.JSX.Element {
  const router = useRouter();
  const [objectKey, setObjectKey] = useState("");
  const [altText, setAltText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function refresh(): Promise<void> { await router.invalidate(); }
  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      await createMerchantProductImage({ data: { productId: product.id, objectKey: objectKey.trim(), altText: altText.trim() || null, position: product.images.length } });
      setObjectKey(""); setAltText(""); setStatus("Imagem associada ao produto."); await refresh();
    } catch (cause) { setStatus(messageFrom(cause, "Não foi possível associar a imagem.")); }
    finally { setBusy(false); }
  }
  return <section className="k-workspace-section">
    <header className="k-section-head"><div><span className="k-section-kicker">Mídia</span><h2>Imagens do produto</h2><p>Associe imagens já armazenadas para esta loja. A primeira imagem na ordem é a principal.</p></div><span className="k-section-count">{product.images.length} imagem(ns)</span></header>
    <form className="k-card k-form" onSubmit={(event) => { void submit(event); }}><div className="k-form__grid">
      <label className="k-field k-field--full"><span>Chave da imagem</span><input required maxLength={1024} value={objectKey} onChange={(e) => { setObjectKey(e.target.value); }} placeholder="tenants/.../stores/.../product/..." /><small>Use somente uma imagem já enviada para a mídia desta loja. Upload direto ainda não está disponível.</small></label>
      <label className="k-field k-field--full"><span>Texto alternativo</span><input maxLength={240} value={altText} onChange={(e) => { setAltText(e.target.value); }} placeholder={product.name} /></label>
    </div><div className="k-actions">{status ? <span className="k-status">{status}</span> : null}<button className="k-button k-button--primary" type="submit" disabled={busy}>{busy ? "Associando…" : "Adicionar imagem"}</button></div></form>
    {product.images.length ? <div className="k-stack">{product.images.map((image, index) => <ImageRow key={image.id} product={product} image={image} primary={index === 0} onSaved={refresh} />)}</div> : <div className="k-empty"><strong>Nenhuma imagem associada</strong><span>Associe uma imagem já existente na mídia desta loja para começar.</span></div>}
    <div className="k-inline-state"><strong>Armazenamento</strong><span>Remover daqui desfaz apenas a associação com o produto. O arquivo físico não é apagado porque o projeto ainda não possui provider de exclusão de mídia ligado ao Admin.</span></div>
  </section>;
}
