import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Category, Product } from "@white-label/catalog";
import { saveMerchantProductEditor } from "../../lib/server/product-editor.functions.ts";
import { uploadMerchantMedia, discardUploadedMerchantMedia } from "../../lib/media-upload.ts";
import { initialProductDraft, initialVariantDraft, productEditorInput } from "./product-editor-draft.ts";
import type { ProductDraft } from "./product-editor-draft.ts";
import { ProductInformation, ProductPrices, ProductStock, ProductPublishing } from "./product-form-layout.tsx";
import { ProductOptionsDraft } from "./product-options-draft.tsx";
import { ProductImageManager } from "./product-image-manager.tsx";
import { ProductPendingPhotos } from "./product-pending-photos.tsx";
import type { PendingPhoto } from "./product-pending-photos.tsx";

type Tab = "info" | "photos" | "prices" | "stock" | "options" | "publish";
export function ProductForm({ product, categories }: Readonly<{ product: Product | null; categories: Category[] }>) {
  const router = useRouter();
  const [saved,setSaved] = useState(product);
  const [draft,setDraft] = useState(() => initialProductDraft(product));
  const [variants,setVariants] = useState(() => product?.variants.map(initialVariantDraft) ?? []);
  const [photos,setPhotos] = useState<PendingPhoto[]>([]);
  const [tab,setTab] = useState<Tab>("info");
  const [saving,setSaving] = useState(false), [status,setStatus] = useState("");
  const tabs: {key: Tab; label: string}[] = [{key:"info",label:"Informações"},{key:"photos",label:"Fotos"},{key:"prices",label:"Preços"},
    draft.hasVariants ? {key:"options",label:"Tamanhos, cores e opções"} : {key:"stock",label:"Estoque"},{key:"publish",label:"Publicar"}];
  const index = Math.max(0,tabs.findIndex(t => t.key === tab));
  const activeTab = tabs[index].key;
  function setField<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) { setDraft(old => ({...old,[key]:value})); }
  async function save() {
    if (saving) return;
    setSaving(true); setStatus("");
    const assets: string[] = [];
    try {
      const input = productEditorInput(draft,variants,saved);
      for (const [index,photo] of photos.entries()) {
        setStatus(`Enviando foto ${String(index+1)} de ${String(photos.length)}…`);
        const asset = await uploadMerchantMedia(photo.file,"product"); assets.push(asset.id);
        input.photos.push({assetId:asset.id,position:(product?.images.length ?? 0)+index});
      }
      const next = await saveMerchantProductEditor({data:input});
      assets.length = 0; setPhotos([]);
      setSaved(next); setDraft(old => ({...old,stock:String(next.stockQuantity)})); setVariants(next.variants.map(initialVariantDraft));
      setStatus("Produto salvo.");
      if (!product) await router.navigate({to:"/admin/products/$id",params:{id:next.id}});
      else await router.invalidate();
    } catch (error) {
      await Promise.allSettled(assets.map(id => discardUploadedMerchantMedia(id)));
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    }
    finally { setSaving(false); }
  }
  const fields = {draft,setField};
  return <div className="createWizard">
    <nav className="createWizardSteps" aria-label="Cadastro e edição de produto">{tabs.map((t,i) => <button type="button" key={t.key} disabled={saving} aria-label={t.label} aria-current={activeTab === t.key ? "step" : undefined} className={activeTab === t.key ? "isActive" : ""} onClick={() => { setTab(t.key); }}><b>{i+1}</b><span className="productStepFull">{t.label}</span><span className="productStepShort">{t.key === "info" ? "Básico" : t.key === "prices" ? "Preço" : t.key === "options" ? "Opções" : t.label}</span></button>)}</nav>
    <fieldset disabled={saving} className="createWizardPanel">
      <div hidden={activeTab !== "info"}><ProductInformation {...fields} categories={categories} editing={Boolean(product)} existingVariants={Boolean(product?.variants.length)} /></div>
      <div hidden={activeTab !== "photos"}><>{product ? <ProductImageManager product={product} /> : <ProductPendingPhotos photos={photos} setPhotos={setPhotos} disabled={saving} />}</></div>
      <div hidden={activeTab !== "prices"}><ProductPrices {...fields} /></div>
      <div hidden={activeTab !== "stock"}><ProductStock {...fields} /></div>
      <div hidden={activeTab !== "options"}><ProductOptionsDraft variants={variants} setVariants={setVariants} basePrice={draft.price} disabled={saving} /></div>
      <div hidden={activeTab !== "publish"}><ProductPublishing {...fields} /></div>
    </fieldset>
    {status ? <p role="status" className="k-status">{status}</p> : null}
    <footer className="createWizardFooter"><button type="button" className="k-button" disabled={saving || index === 0} onClick={() => { setTab(tabs[index-1].key); }}>Voltar</button>
      {index < tabs.length-1 ? <button type="button" className="k-button" disabled={saving} onClick={() => { setTab(tabs[index+1].key); }}>Continuar</button> : null}
      <button type="button" className="k-button k-button--primary" disabled={saving} onClick={() => { void save(); }}>{saving ? "Salvando…" : "Salvar produto"}</button>
    </footer>
  </div>;
}
