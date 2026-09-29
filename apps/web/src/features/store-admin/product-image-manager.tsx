import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { getCatalogPublicMediaUrl } from "@white-label/catalog";
import type { Product, ProductImage } from "@white-label/catalog";
import { setMerchantPrimaryProductImage } from "../../lib/server/catalog-admin.functions.ts";
import {
  createUploadedProductImage,
  removeUploadedProductImage,
  updateUploadedProductImage,
} from "../../lib/server/media-association.functions.ts";
import { discardUploadedMerchantMedia, uploadMerchantMedia } from "../../lib/media-upload.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function replaceProductImage(args: Readonly<{
  file: File;
  product: Product;
  image: ProductImage;
  altText: string;
  position: number;
  setStatus: (value: string) => void;
  onSaved: () => Promise<void>;
}>): Promise<void> {
  let assetId: string | null = null;
  try {
    const asset = await uploadMerchantMedia(args.file, "product");
    assetId = asset.id;
    await updateUploadedProductImage({ data: {
      id: args.image.id, productId: args.product.id, assetId: asset.id,
      altText: args.altText.trim() || null, position: args.position,
    } });
    args.setStatus("Imagem substituída.");
    await args.onSaved();
  } catch (cause) {
    if (assetId) { try { await discardUploadedMerchantMedia(assetId); } catch { /* cleanup server-side */ } }
    args.setStatus(messageFrom(cause, "Não foi possível substituir a imagem."));
  }
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
    void action(() => updateUploadedProductImage({ data: {
      id: props.image.id, productId: props.product.id, altText: altText.trim() || null, position: Number(position),
    } }), "Imagem atualizada.", "Não foi possível atualizar a imagem.");
  }
  function makePrimary(): void {
    void action(() => setMerchantPrimaryProductImage({ data: { productId: props.product.id, id: props.image.id } }), "Imagem principal atualizada.", "Não foi possível alterar a imagem principal.");
  }
  function remove(): void {
    if (!confirmDangerousAction("Remover esta imagem do produto? O arquivo será excluído se não estiver em uso.")) return;
    void action(() => removeUploadedProductImage({ data: { productId: props.product.id, id: props.image.id } }), "Imagem removida.", "Não foi possível remover a imagem.");
  }
  async function replace(file: File | undefined): Promise<void> {
    if (!file) return;
    setSaving(true); setStatus("Enviando nova imagem…");
    try {
      await replaceProductImage({ file, product: props.product, image: props.image, altText, position: Number(position), setStatus, onSaved: props.onSaved });
    } finally { setSaving(false); }
  }

  return <article className="k-card"><div className="k-row" style={{ alignItems: "flex-start" }}>
    <img src={imageUrl} alt={props.image.altText ?? props.product.name} width="112" height="112" style={{ objectFit: "cover", borderRadius: 10 }} />
    <div className="k-row__main">
      <div className="k-row__title">{props.primary ? "Imagem principal" : `Imagem ${String(props.image.position + 1)}`}</div>
      <div className="k-form__grid" style={{ marginTop: 12 }}>
        <label className="k-field"><span>Texto alternativo</span><input maxLength={240} value={altText} onChange={(event) => { setAltText(event.target.value); }} /></label>
        <label className="k-field"><span>Ordem</span><input type="number" min={0} max={1000000} value={position} onChange={(event) => { setPosition(event.target.value); }} /></label>
        <label className="k-field k-field--full"><span>Substituir arquivo</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={(event) => { void replace(event.target.files?.[0]); event.currentTarget.value = ""; }} /><small>JPG, PNG ou WebP, até 10 MB.</small></label>
      </div>
      {status ? <div className="k-row__meta" role="status" style={{ marginTop: 8 }}>{status}</div> : null}
      <div className="k-actions"><button className="k-button" type="button" disabled={saving} onClick={save}>Salvar imagem</button>{!props.primary ? <button className="k-button" type="button" disabled={saving} onClick={makePrimary}>Tornar principal</button> : null}<button className="k-button" type="button" disabled={saving} onClick={remove}>Remover</button></div>
    </div>
  </div></article>;
}

export function ProductImageManager({ product }: Readonly<{ product: Product }>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function refresh(): Promise<void> { await router.invalidate(); }
  async function upload(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    setBusy(true); setStatus(`Enviando ${String(files.length)} imagem(ns)…`);
    let added = 0;
    try {
      for (const [index, file] of Array.from(files).entries()) {
        const asset = await uploadMerchantMedia(file, "product");
        try {
          await createUploadedProductImage({ data: { productId: product.id, assetId: asset.id, altText: product.name, position: product.images.length + index } });
          added += 1;
        } catch (error) {
          try { await discardUploadedMerchantMedia(asset.id); } catch { /* cleanup server-side */ }
          throw error;
        }
      }
      setStatus(`${String(added)} imagem(ns) adicionada(s).`); await refresh();
    } catch (cause) {
      setStatus(messageFrom(cause, `Falha após adicionar ${String(added)} imagem(ns).`));
    } finally { setBusy(false); }
  }
  return <section className="k-workspace-section">
    <header className="k-section-head"><div><span className="k-section-kicker">Mídia</span><h2>Imagens do produto</h2><p>Envie imagens reais para o storage. A primeira imagem na ordem é a principal.</p></div><span className="k-section-count">{product.images.length} imagem(ns)</span></header>
    <div className="k-card k-form"><label className="k-field"><span>Adicionar imagens</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = ""; }} /><small>JPG, PNG ou WebP, até 10 MB por arquivo.</small></label>{status ? <div className="k-status" role="status">{status}</div> : null}</div>
    {product.images.length ? <div className="k-stack">{product.images.map((image, index) => <ImageRow key={image.id} product={product} image={image} primary={index === 0} onSaved={refresh} />)}</div> : <div className="k-empty"><strong>Nenhuma imagem associada</strong><span>Escolha uma ou mais imagens para começar.</span></div>}
  </section>;
}
