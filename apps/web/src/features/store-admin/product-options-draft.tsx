import { useState } from "react";
import type { VariantDraft } from "./product-editor-draft.ts";
import { variantKey } from "./product-editor-draft.ts";
type Group = { key: string; name: string; values: string };
function initialGroups(variants: VariantDraft[]): Group[] {
  const groups = new Map<string, Set<string>>();
  for (const v of variants) for (const [name,value] of Object.entries(v.attributes)) {
    const values = groups.get(name) ?? new Set<string>(); values.add(value); groups.set(name,values);
  }
  return groups.size ? [...groups].map(([name,values]) => ({ key: crypto.randomUUID(), name, values: [...values].join(", ") })) : [{ key: "size", name: "Tamanho", values: "" }, { key: "color", name: "Cor", values: "" }];
}
export function ProductOptionsDraft({ variants, setVariants, basePrice, disabled }: Readonly<{ variants: VariantDraft[]; setVariants: (v: VariantDraft[]) => void; basePrice: string; disabled: boolean }>) {
  const [groups,setGroups] = useState(() => initialGroups(variants));
  const [status,setStatus] = useState("");
  function updateGroup(key: string, field: "name" | "values", value: string) { setGroups(old => old.map(g => g.key === key ? {...g,[field]:value} : g)); }
  function generate() {
    try {
      let combinations: Record<string,string>[] = [{}]; const names = new Set<string>();
      for (const g of groups) {
        const name = g.name.trim(), values = [...new Set(g.values.split(",").map(v => v.trim()).filter(Boolean))];
        if (!values.length) continue;
        if (!name || names.has(name)) throw new Error("Informe nomes diferentes para cada opção.");
        names.add(name);
        if (combinations.length * values.length > 200) throw new Error("Use no máximo 200 combinações por produto.");
        combinations = combinations.flatMap(c => values.map(v => ({...c,[name]:v})));
      }
      if (!names.size) throw new Error("Informe os valores de pelo menos uma opção.");
      const existing = new Map(variants.map(v => [variantKey(v.attributes),v]));
      const generated = combinations.map(attributes => existing.get(variantKey(attributes)) ?? {
        key: variantKey(attributes), name: Object.values(attributes).join(" / "), attributes,
        sku: "", price: basePrice, promotion: "", cost: "", stock: "0", active: true,
      });
      const keys = new Set(generated.map(v => v.key));
      setVariants([...variants.filter(v => v.id && !keys.has(v.key)),...generated]); setStatus("");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Não foi possível gerar as opções."); }
  }
  function update(key: string, field: "price" | "promotion" | "cost" | "stock" | "sku" | "active", value: string | boolean) {
    setVariants(variants.map(v => v.key === key ? {...v,[field]:value} : v));
  }
  return <div className="wizardFields"><h2>Tamanhos, cores e opções</h2>
    <p>Cada combinação pode ter preço, custo e estoque próprios.</p>
    {groups.map(g => <div className="variantOptionRow" key={g.key}><label>Opção<input value={g.name} disabled={disabled} onChange={e => { updateGroup(g.key,"name",e.target.value); }} /></label><label>Valores<input value={g.values} disabled={disabled} placeholder="P, M, G" onChange={e => { updateGroup(g.key,"values",e.target.value); }} /></label></div>)}
    <div className="k-actions"><button type="button" className="k-button" disabled={disabled} onClick={() => { setGroups(old => [...old,{key:crypto.randomUUID(),name:"",values:""}]); }}>Adicionar opção</button><button type="button" className="k-button" disabled={disabled} onClick={generate}>Gerar combinações</button></div>
    {status ? <p role="alert">{status}</p> : null}
    <div className="wizardVariants">{variants.map(v => <article key={v.key} className="productOptionCard"><strong>{v.name}</strong><div className="wizardGrid">
      <label>Preço (R$)<input inputMode="decimal" disabled={disabled} value={v.price} onChange={e => { update(v.key,"price",e.target.value); }} /></label>
      <label>Preço promocional (R$)<input inputMode="decimal" disabled={disabled} value={v.promotion} onChange={e => { update(v.key,"promotion",e.target.value); }} /></label>
      <label>Quanto você pagou (R$)<input inputMode="decimal" disabled={disabled} value={v.cost} onChange={e => { update(v.key,"cost",e.target.value); }} /></label>
      <label>Quantidade em estoque<input type="number" min="0" max="1000000" disabled={disabled} value={v.stock} onChange={e => { update(v.key,"stock",e.target.value); }} /></label>
      <label>Código do produto<input disabled={disabled} value={v.sku} onChange={e => { update(v.key,"sku",e.target.value); }} /></label>
      <label className="checkRow"><input type="checkbox" disabled={disabled} checked={v.active} onChange={e => { update(v.key,"active",e.target.checked); }} /><span>Disponível no catálogo</span></label>
    </div>{!v.id ? <button type="button" className="k-button" disabled={disabled} onClick={() => { setVariants(variants.filter(x => x.key !== v.key)); }}>Remover combinação</button> : null}</article>)}</div>
  </div>;
}
