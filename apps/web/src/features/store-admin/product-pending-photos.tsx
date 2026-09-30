import { useEffect, useState } from "react";
export interface PendingPhoto { key: string; file: File; }
function Preview({ photo }: Readonly<{ photo: PendingPhoto }>) {
  const [url,setUrl] = useState("");
  useEffect(() => { const next = URL.createObjectURL(photo.file); setUrl(next); return () => { URL.revokeObjectURL(next); }; },[photo.file]);
  return url ? <img src={url} alt={photo.file.name} width="160" height="160" /> : null;
}
export function ProductPendingPhotos({ photos, setPhotos, disabled }: Readonly<{ photos: PendingPhoto[]; setPhotos: (p: PendingPhoto[]) => void; disabled: boolean }>) {
  const [status,setStatus] = useState("");
  function select(files: FileList | null) {
    if (!files) return;
    const valid = Array.from(files).filter(f => ["image/jpeg","image/png","image/webp"].includes(f.type) && f.size <= 10*1024*1024);
    setStatus(valid.length === files.length ? "" : "Use JPG, PNG ou WebP, até 10 MB por foto.");
    setPhotos([...photos,...valid.map(file => ({ key: crypto.randomUUID(), file }))]);
  }
  return <div className="wizardFields"><h2>Fotos do produto</h2>
    <label className="wizardDrop">Selecionar fotos<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={e => { select(e.target.files); e.currentTarget.value = ""; }} /><small>JPG, PNG ou WebP, até 10 MB por foto.</small></label>
    {status ? <p role="alert">{status}</p> : null}
    <div className="productPhotosGrid">{photos.map((p,i) => <article className="productOptionCard" key={p.key}><Preview photo={p} /><strong>{i === 0 ? "Foto de capa" : p.file.name}</strong>
      <div className="k-actions">{i > 0 ? <button type="button" className="k-button" disabled={disabled} onClick={() => { setPhotos([p,...photos.filter(x => x.key !== p.key)]); }}>Usar como capa</button> : null}
      <button type="button" className="k-button" disabled={disabled} onClick={() => { setPhotos(photos.filter(x => x.key !== p.key)); }}>Remover</button></div>
    </article>)}</div>
  </div>;
}
