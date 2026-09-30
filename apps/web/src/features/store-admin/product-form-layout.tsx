import type { Category } from "@white-label/catalog";
import type { ProductDraft } from "./product-editor-draft.ts";
import { moneyToCents, formatMoney, slugify } from "./format.ts";
export type SetProductField = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => void;
type Fields = Readonly<{ draft: ProductDraft; setField: SetProductField }>;
export function ProductInformation({ draft: d, setField, categories, existingVariants, editing }: Fields & Readonly<{ categories: Category[]; existingVariants: boolean; editing: boolean }>) {
  function toggleCategory(id: string) { setField("categoryIds",d.categoryIds.includes(id) ? d.categoryIds.filter(c => c !== id) : [...d.categoryIds,id]); }
  return <div className="wizardFields">
    <label>Nome *<input value={d.name} maxLength={160} onChange={e => { setField("name",e.target.value); if (!editing) setField("slug",slugify(e.target.value)); }} /></label>
    <label>Endereço do produto<input value={d.slug} onChange={e => { setField("slug",slugify(e.target.value)); }} /><small>É criado automaticamente a partir do nome.</small></label>
    <label>Descrição<textarea rows={4} maxLength={5000} value={d.description} onChange={e => { setField("description",e.target.value); }} /></label>
    <fieldset className="commercialBox"><legend>Categorias</legend><p>Selecione uma ou mais categorias.</p>{categories.map(c => <label className="checkRow" key={c.id}><input type="checkbox" checked={d.categoryIds.includes(c.id)} onChange={() => { toggleCategory(c.id); }} /><span>{c.name}</span></label>)}{!categories.length ? <p>Nenhuma categoria cadastrada.</p> : null}</fieldset>
    <label className="checkRow"><input type="checkbox" checked={d.hasVariants} disabled={existingVariants} onChange={e => { setField("hasVariants",e.target.checked); }} /><span>Este produto tem tamanhos, cores ou outras opções?</span></label>
    <p className="k-muted">Ative quando o cliente precisar escolher tamanho, cor, número ou voltagem. Cada opção pode ter preço e estoque próprios.</p>
  </div>;
}
function safeMoney(value: string): number { try { return moneyToCents(value); } catch { return 0; } }
export function ProductPrices({ draft: d, setField }: Fields) {
  const price = safeMoney(d.promotion || d.price), cost = safeMoney(d.cost);
  return <div className="wizardFields"><div className="wizardGrid">
    <label>Preço (R$) *<input inputMode="decimal" value={d.price} placeholder="0,00" onChange={e => { setField("price",e.target.value); }} /></label>
    <label>Preço promocional (R$)<input inputMode="decimal" value={d.promotion} placeholder="Opcional" onChange={e => { setField("promotion",e.target.value); }} /></label>
    {!d.hasVariants ? <label>Quanto você pagou (R$)<input inputMode="decimal" value={d.cost} placeholder="0,00" onChange={e => { setField("cost",e.target.value); }} /><small>Opcional. Não aparece para o cliente.</small></label> : null}
  </div>{!d.hasVariants && cost > 0 ? <p>Lucro estimado por unidade: <strong>{formatMoney(price-cost)}</strong></p> : null}
    <label className="checkRow"><input type="checkbox" checked={Number(d.pixDiscount)>0} onChange={e => { setField("pixDiscount",e.target.checked ? "5" : "0"); }} /><span>Dar desconto no Pix</span></label>
    {Number(d.pixDiscount)>0 ? <label>Desconto no Pix (%)<input type="number" min="0" max="100" step="0.01" value={d.pixDiscount} onChange={e => { setField("pixDiscount",e.target.value); }} /><small>Preço no Pix: {formatMoney(Math.round(price*(1-Number(d.pixDiscount)/100)))}</small></label> : null}
  </div>;
}
export function ProductStock({ draft: d, setField }: Fields) {
  return <div className="wizardFields"><div className="wizardGrid">
    <label>Quantidade em estoque<input type="number" min="0" max="1000000" step="1" value={d.stock} onChange={e => { setField("stock",e.target.value); }} /><small>Quantas unidades você tem disponíveis para vender.</small></label>
    <label>Código do produto<input value={d.sku} onChange={e => { setField("sku",e.target.value); }} placeholder="Ex.: COPO-PRETO" /></label>
    <label>Código de barras<input value={d.barcode} onChange={e => { setField("barcode",e.target.value); }} placeholder="EAN / GTIN" /></label>
  </div><p className="k-muted">Edite a quantidade aqui sempre que precisar. Vendas confirmadas descontam o estoque automaticamente.</p></div>;
}
export function ProductPublishing({ draft: d, setField }: Fields) {
  return <div className="wizardFields"><h2>Como este produto aparece na sua loja</h2>
    <label className="checkRow"><input type="checkbox" checked={d.active} onChange={e => { setField("active",e.target.checked); }} /><span>Mostrar na loja</span></label>
    <p className="k-muted">Quando desligado, o produto fica salvo no painel, mas não aparece para os clientes.</p>
    <label className="checkRow"><input type="checkbox" checked={d.featured} onChange={e => { setField("featured",e.target.checked); }} /><span>Destacar este produto</span></label>
    <details><summary>Mais opções</summary><label>Ordem na loja<input type="number" min="0" value={d.position} onChange={e => { setField("position",e.target.value); }} /><small>Números menores aparecem primeiro.</small></label></details>
  </div>;
}
