import type { Category } from "@white-label/catalog";
import { slugify } from "./format.ts";

export interface ProductDraft {
  name: string;
  slug: string;
  description: string;
  sku: string;
  categoryId: string;
  price: string;
  compareAt: string;
  cost: string;
  stock: string;
  position: string;
  active: boolean;
  trackInventory: boolean;
}

type SetField = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => void;

function Field(props: Readonly<{ label: string; hint?: string; children: React.ReactNode }>): React.JSX.Element {
  return <label className="productField"><span>{props.label}</span>{props.children}{props.hint ? <small>{props.hint}</small> : null}</label>;
}

function Toggle(props: Readonly<{ checked: boolean; title: string; description: string; onChange: (value: boolean) => void }>): React.JSX.Element {
  return <label className="productToggle"><span><strong>{props.title}</strong><small>{props.description}</small></span><input type="checkbox" checked={props.checked} onChange={(event) => { props.onChange(event.target.checked); }} /></label>;
}

export function ProductEditorLayout({ draft, categories, hasVariants, setField }: Readonly<{ draft: ProductDraft; categories: Category[]; hasVariants: boolean; setField: SetField }>): React.JSX.Element {
  return <div className="productStudio">
    <main className="productStudioMain">
      <section className="productCard productIdentity">
        <div className="productCardTitle"><span>01</span><div><h2>Informações do produto</h2><p>O essencial para o cliente entender o que você vende.</p></div></div>
        <div className="productFields">
          <Field label="Nome do produto"><input id="product-name" value={draft.name} onChange={(event) => { const name = event.target.value; setField("name", name); if (!draft.slug) setField("slug", slugify(name)); }} required autoFocus placeholder="Ex.: Tênis Runner Pro" /></Field>
          <Field label="Descrição" hint="Escreva como se estivesse apresentando o produto para o cliente."><textarea value={draft.description} onChange={(event) => { setField("description", event.target.value); }} placeholder="Material, diferenciais, medidas e outras informações importantes…" /></Field>
          <Field label="Categoria"><select value={draft.categoryId} onChange={(event) => { setField("categoryId", event.target.value); }}><option value="">Selecionar categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.active ? "" : " (inativa)"}</option>)}</select></Field>
        </div>
      </section>

      <section className="productCard">
        <div className="productCardTitle"><span>02</span><div><h2>Preço</h2><p>{hasVariants ? "Defina o preço base; variações podem ter valores próprios." : "Defina quanto o cliente paga e, se quiser, mostre uma oferta."}</p></div></div>
        <div className="productPriceGrid">
          <Field label="Preço de venda"><div className="moneyInput"><b>R$</b><input inputMode="decimal" value={draft.price} onChange={(event) => { setField("price", event.target.value); }} required placeholder="0,00" /></div></Field>
          <Field label="Preço anterior" hint="Opcional. Use quando houver promoção."><div className="moneyInput"><b>R$</b><input inputMode="decimal" value={draft.compareAt} onChange={(event) => { setField("compareAt", event.target.value); }} placeholder="0,00" /></div></Field>
        </div>
      </section>

      <section className="productCard productAdvanced">
        <div className="productCardTitle"><span>03</span><div><h2>Organização</h2><p>Informações internas. O cliente não precisa ver isso.</p></div></div>
        <div className="productAdvancedGrid">
          <Field label="SKU / código"><input value={draft.sku} onChange={(event) => { setField("sku", event.target.value); }} placeholder="Ex.: TEN-RUN-001" /></Field>
          <Field label="Custo interno"><div className="moneyInput"><b>R$</b><input inputMode="decimal" value={draft.cost} onChange={(event) => { setField("cost", event.target.value); }} placeholder="0,00" /></div></Field>
          <Field label="URL do produto"><input value={draft.slug} onChange={(event) => { setField("slug", slugify(event.target.value)); }} required /></Field>
          <Field label="Posição no catálogo"><input type="number" min="0" value={draft.position} onChange={(event) => { setField("position", event.target.value); }} /></Field>
        </div>
      </section>
    </main>

    <aside className="productStudioSide">
      <section className="productPublishCard">
        <div className="productPublishHead"><span className={draft.active ? "productLiveDot isLive" : "productLiveDot"} /><div><strong>{draft.active ? "Produto publicado" : "Produto oculto"}</strong><small>Você pode mudar isso a qualquer momento.</small></div></div>
        <Toggle checked={draft.active} title="Disponível no catálogo" description="Clientes conseguem encontrar e comprar." onChange={(value) => { setField("active", value); }} />
        <Toggle checked={draft.trackInventory} title="Controlar estoque" description="Acompanhe a quantidade disponível." onChange={(value) => { setField("trackInventory", value); }} />
        {draft.trackInventory ? <div className="productStockSummary"><span>Quantidade atual</span><strong>{draft.stock}</strong><small>Movimentações continuam sendo feitas pela área Estoque.</small></div> : null}
      </section>
      <section className="productHelpCard"><span>Próximo passo</span><strong>Salve para adicionar fotos e variações</strong><p>Depois você poderá cadastrar cores, tamanhos e imagens sem recriar o produto.</p></section>
    </aside>
  </div>;
}
