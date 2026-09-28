import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { ProductVariant, VariantMutationInput } from "@white-label/catalog";
import { createMerchantVariant } from "../../lib/server/catalog-admin.functions.ts";

type OptionGroup = { name: string; values: string };
type Combo = { attributes: Record<string, string>; name: string; key: string };

function normalize(value: string): string { return value.trim().toLocaleLowerCase("pt-BR"); }
function comboKey(attributes: Record<string,string>): string { return Object.entries(attributes).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${normalize(k)}=${normalize(v)}`).join("|"); }
function combinations(groups: OptionGroup[]): Combo[] {
  const clean=groups.map(g=>({name:g.name.trim(),values:[...new Set(g.values.split(",").map(v=>v.trim()).filter(Boolean))]})).filter(g=>g.name&&g.values.length);
  if(!clean.length)return [];
  let rows:Record<string,string>[]=[{}];
  for(const group of clean){rows=rows.flatMap(row=>group.values.map(value=>({...row,[group.name]:value})));}
  return rows.map(attributes=>({attributes,name:Object.values(attributes).join(" / "),key:comboKey(attributes)}));
}

export function VariantGenerator({productId,variants,basePriceCents}:Readonly<{productId:string;variants:ProductVariant[];basePriceCents:number}>):React.JSX.Element{
  const router=useRouter();
  const[groups,setGroups]=useState<OptionGroup[]>([{name:"Tamanho",values:""},{name:"Cor",values:""}]);
  const[busy,setBusy]=useState(false);const[status,setStatus]=useState("");
  const existing=useMemo(()=>new Set(variants.map(v=>comboKey(v.attributes))),[variants]);
  const combos=useMemo(()=>combinations(groups),[groups]);
  const pending=combos.filter(c=>!existing.has(c.key));
  function change(index:number,key:keyof OptionGroup,value:string){setGroups(current=>current.map((g,i)=>i===index?{...g,[key]:value}:g));}
  async function generate():Promise<void>{if(!pending.length){setStatus("Nenhuma variação nova para criar.");return;}setBusy(true);setStatus("");try{for(const [index,combo] of pending.entries()){const input:VariantMutationInput={productId,name:combo.name,sku:null,attributes:combo.attributes,priceCents:basePriceCents,compareAtPriceCents:null,costCents:null,active:true,stockQuantity:0,position:variants.length+index};await createMerchantVariant({data:input});}setStatus(`${String(pending.length)} nova(s) variação(ões) criada(s). As existentes foram mantidas.`);await router.invalidate();}catch(error){setStatus(error instanceof Error?error.message:"Não foi possível gerar as variações.");}finally{setBusy(false);}}
  return <section className="k-workspace-section variantWizard"><header className="k-section-head"><div><span className="k-section-kicker">GERADOR DE VARIAÇÕES</span><h2>Crie todas as combinações de uma vez</h2><p>Digite os valores separados por vírgula. Ao adicionar novos valores depois, só as combinações que ainda não existem serão criadas.</p></div></header><div className="variantWizardBody"><div className="variantOptionGroups">{groups.map((group,index)=><div className="variantOptionRow" key={index}><label className="k-field"><span>Opção</span><input value={group.name} placeholder="Ex.: Tamanho" onChange={e=>change(index,"name",e.target.value)}/></label><label className="k-field"><span>Valores</span><input value={group.values} placeholder="Ex.: P, M, G, GG" onChange={e=>change(index,"values",e.target.value)}/></label>{groups.length>1?<button type="button" className="k-button" onClick={()=>setGroups(current=>current.filter((_,i)=>i!==index))}>Remover</button>:null}</div>)}</div><button type="button" className="k-button" onClick={()=>setGroups(current=>[...current,{name:"",values:""}])}>+ Adicionar opção</button>{combos.length?<div className="variantPreview"><strong>{String(combos.length)} combinação(ões)</strong><span>{String(combos.length-pending.length)} já existem · {String(pending.length)} novas</span><div>{combos.slice(0,12).map(c=><span className={existing.has(c.key)?"variantChip isExisting":"variantChip"} key={c.key}>{c.name}{existing.has(c.key)?" ✓":""}</span>)}</div>{combos.length>12?<small>+ {String(combos.length-12)} combinações</small>:null}</div>:null}<div className="variantWizardFooter">{status?<span className="k-status" role="status">{status}</span>:null}<button type="button" className="k-button k-button--primary" disabled={busy||!pending.length} onClick={()=>void generate()}>{busy?"Gerando…":pending.length?`Gerar ${String(pending.length)} nova(s) variação(ões)`:"Tudo atualizado"}</button></div></div></section>;
}
