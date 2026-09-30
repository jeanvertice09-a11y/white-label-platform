import { Link } from "@tanstack/react-router";
import { getCatalogPublicMediaUrl } from "@white-label/catalog";
import type { Category, Product } from "@white-label/catalog";
import { formatMoney } from "./format.ts";
export function ProductListTable({products,categories,selected,toggle,all,busy,action,duplicate}:Readonly<{
  products:Product[]; categories:Category[]; selected:Set<string>; toggle:(id:string)=>void; all:()=>void;
  busy:boolean; action:(action:"publish"|"hide"|"delete",ids:string[])=>void; duplicate:(p:Product)=>void;
}>) {
  return <div className="k-table-wrap"><table className="k-table"><thead><tr><th><input type="checkbox" aria-label="Selecionar todos os produtos da página" checked={products.length>0 && products.every(p=>selected.has(p.id))} onChange={all}/></th><th>Produto</th><th>Categorias</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>{products.map(p=><ProductRow key={p.id} product={p} categories={categories} checked={selected.has(p.id)} toggle={toggle} busy={busy} action={action} duplicate={duplicate}/>)}</tbody>
  </table></div>;
}
function ProductRow({product:p,categories,checked,toggle,busy,action,duplicate}:Readonly<{product:Product;categories:Category[];checked:boolean;toggle:(id:string)=>void;busy:boolean;action:(action:"publish"|"hide"|"delete",ids:string[])=>void;duplicate:(p:Product)=>void;}>) {
  const image=p.images.at(0), ids=p.categoryIds.length?p.categoryIds:p.categoryId?[p.categoryId]:[];
  return <tr><td><input type="checkbox" aria-label={`Selecionar ${p.name}`} checked={checked} disabled={busy} onChange={()=>{toggle(p.id);}}/></td><td><Link className="k-product-row" to="/admin/products/$id" params={{id:p.id}}><div className="k-product-thumb">{image?<img src={getCatalogPublicMediaUrl(p,image.objectKey)} alt={image.altText??p.name} loading="lazy"/>:<span>Sem foto</span>}</div><div><strong>{p.name}</strong><div className="k-row__meta">{p.variants.length?`${String(p.variants.length)} opções`:p.sku??"Produto simples"}</div></div></Link></td>
    <td>{categories.filter(c=>ids.includes(c.id)).map(c=>c.name).join(", ")||"Sem categoria"}</td><td>{p.compareAtPriceCents?<small><s>{formatMoney(p.compareAtPriceCents)}</s><br/></small>:null}{formatMoney(p.priceCents)}</td>
    <td>{p.trackInventory?String(p.variants.length?p.variants.reduce((n,v)=>n+v.stockQuantity,0):p.stockQuantity):"—"}</td><td>{p.active?"Publicado":"Oculto"}</td>
    <td><div className="k-actions"><Link className="k-text-action" to="/admin/products/$id" params={{id:p.id}}>Editar</Link><details><summary aria-label={`Mais ações para ${p.name}`}>Mais</summary><div className="k-stack"><button className="k-button" disabled={busy} type="button" onClick={()=>{duplicate(p);}}>Duplicar</button><button className="k-button" disabled={busy} type="button" onClick={()=>{action(p.active?"hide":"publish",[p.id]);}}>{p.active?"Ocultar":"Publicar"}</button><button className="k-button" disabled={busy} type="button" onClick={()=>{action("delete",[p.id]);}}>Excluir</button></div></details></div></td>
  </tr>;
}
