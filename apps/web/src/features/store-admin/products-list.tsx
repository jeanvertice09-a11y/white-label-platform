import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { CatalogPage, CatalogQuery, Category, Product } from "@white-label/catalog";
import { listMerchantProducts } from "../../lib/server/catalog.functions.ts";
import { changeMerchantProducts } from "../../lib/server/product-list.functions.ts";
import { duplicateMerchantProduct } from "../../lib/server/catalog-admin.functions.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";
import { ProductListTable } from "./product-list-table.tsx";
export function ProductsList({initialPage,categories}:Readonly<{initialPage:CatalogPage;categories:Category[]}>) {
  const [data,setData]=useState(initialPage),[search,setSearch]=useState(""),[categoryId,setCategoryId]=useState("");
  const [status,setStatus]=useState("all"),[sort,setSort]=useState<NonNullable<CatalogQuery["sort"]>>("position");
  const [selected,setSelected]=useState(new Set<string>()),[bulkCategory,setBulkCategory]=useState("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function load(page:number) {
    setBusy(true);setMessage("");
    try { setData(await listMerchantProducts({data:{page,pageSize:20,search:search.trim()||undefined,categoryId:categoryId||undefined,active:status==="all"?undefined:status==="active",sort}}));setSelected(new Set()); }
    catch(e){setMessage(e instanceof Error?e.message:"Não foi possível carregar os produtos.");}finally{setBusy(false);}
  }
  function toggle(id:string){setSelected(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  function all(){setSelected(data.items.every(p=>selected.has(p.id))?new Set():new Set(data.items.map(p=>p.id)));}
  async function apply(action:"publish"|"hide"|"delete"|"category",ids:string[]) {
    if(action==="delete"&&!confirmDangerousAction(`Excluir ${String(ids.length)} produto(s) do catálogo?`))return;
    setBusy(true);setMessage("");
    try{await changeMerchantProducts({data:{action,ids,categoryId:bulkCategory||null}});await load(1);setMessage("Produtos atualizados.");}
    catch(e){setMessage(e instanceof Error?e.message:"Não foi possível atualizar os produtos.");}finally{setBusy(false);}
  }
  async function duplicate(p:Product){setBusy(true);try{await duplicateMerchantProduct({data:{productId:p.id}});await load(1);setMessage("Cópia criada. Edite o produto para revisar e publicar.");}catch(e){setMessage(e instanceof Error?e.message:"Não foi possível duplicar.");}finally{setBusy(false);}}
  return <section className="k-workspace-section"><header className="k-section-head"><h2>Seus produtos · {data.total}</h2></header>
    <form className="k-toolbar" onSubmit={e=>{e.preventDefault();void load(1);}}><label>Buscar<input value={search} onChange={e=>{setSearch(e.target.value);}} placeholder="Nome ou código"/></label>
      <label>Categoria<select value={categoryId} onChange={e=>{setCategoryId(e.target.value);}}><option value="">Todas</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Status<select value={status} onChange={e=>{setStatus(e.target.value);}}><option value="all">Todos</option><option value="active">Publicados</option><option value="inactive">Ocultos</option></select></label>
      <label>Ordenar<select value={sort} onChange={e=>{setSort(e.target.value as NonNullable<CatalogQuery["sort"]>);}}><option value="position">Ordem na loja</option><option value="name">Nome</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option><option value="newest">Mais recentes</option></select></label><button className="k-button" disabled={busy} type="submit">Buscar</button>
    </form>
    {selected.size?<div className="k-card"><strong>{selected.size} selecionado(s)</strong><div className="k-actions">{(["publish","hide","delete"] as const).map((action,i)=><button key={action} className="k-button" type="button" disabled={busy} onClick={()=>{void apply(action,[...selected]);}}>{["Publicar","Ocultar","Excluir"][i]}</button>)}<label>Categoria<select value={bulkCategory} onChange={e=>{setBulkCategory(e.target.value);}}><option value="">Sem categoria</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="k-button" disabled={busy} type="button" onClick={()=>{void apply("category",[...selected]);}}>Alterar categoria</button></div></div>:null}
    {message?<p className="k-inline-state" role="status">{message}</p>:null}
    {data.items.length?<ProductListTable products={data.items} categories={categories} selected={selected} toggle={toggle} all={all} busy={busy} action={(a,ids)=>{void apply(a,ids);}} duplicate={p=>{void duplicate(p);}}/>:<div className="k-empty"><p>Nenhum produto encontrado.</p><Link className="k-button k-button--primary" to="/admin/products/new">Adicionar produto</Link></div>}
    {data.total>20?<div className="k-pagination"><button type="button" className="k-button" disabled={busy||data.page<=1} onClick={()=>{void load(data.page-1);}}>Anterior</button><span>Página {data.page} de {Math.ceil(data.total/20)}</span><button type="button" className="k-button" disabled={busy||data.page>=Math.ceil(data.total/20)} onClick={()=>{void load(data.page+1);}}>Próxima</button></div>:null}
  </section>;
}
