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

function Field({ label, hint, children }: Readonly<{ label: string; hint?: string; children: React.ReactNode }>): React.JSX.Element {
  return <label className="productField"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function Toggle({ checked, title, description, onChange }: Readonly<{ checked: boolean; title: string; description: string; onChange: (value: boolean) => void }>): React.JSX.Element {
  return <label className="productToggle"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => { onChange(event.target.checked); }} /></label>;
}

export function ProductEditorLayout({ draft, categories, hasVariants, setField }: Readonly<{ draft: ProductDraft; categories: Category[]; hasVariants: boolean; setField: SetField }>): React.JSX.Element {
  return <div className="productStudio">
    <main className="productStudioMain">
      <section className="productCard">
        <div className="productCardTitle"><span>01</span><div><h2>Sobre o produto</h2><p>Preencha só o que o cliente precisa para entender o produto.</p></div></div>
        <div className="productFields">
          <Field label="Nome do produto"><input id="product-name" value={draft.name} onChange={(event) => { const name = event.target.value; setField("name", name); if (!draft.slug) setField("slug", slugify(name)); }} required autoFocus placeholder="Ex.: Tênis Runner Pro" /></Field>
          <Field label="Descrição" hint="Explique os principais detalhes, materiais e diferenciais."><textarea value={draft.description} onChange={(event) => { setField("description", event.target.value); }} placeholder="Conte para o cliente sobre este produto…" /></Field>
          <Field label="Categoria"><select value={draft.categoryId} onChange={(event) => { setField("categoryId", event.target.value); }}><option value="">Selecionar categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.active ? "" : " (inativa)"}</option>)}</select></Field>
        </div>
      </section>
      <section className="productCard">
        <div className="productCardTitle"><span>02</span><div><h2>Preço</h2><p>{hasVariants ? "Este é o preço padrão. Você pode alterar o preço de cada variação depois." : "Informe o preço que o cliente verá na loja."}</p></div></div>
        <div className="productPriceGrid">
          <Field label="Preço de venda"><div className="moneyInput"><b>R$</b><input inputMode="decimal" value={draft.price} onChange={(event) => { setField("price", event.target.value); }} required placeholder="0,00" /></div></Field>
          <Field label="Preço anterior (opcional)" hint="Use para mostrar uma promoção."><div className="moneyInput"><b>R$</b><input inputMode="decimal" value={draft.compareAt} onChange={(event) => { setField("compareAt", event.target.value); }} placeholder="0,00" /></div></Field>
        </div>
      </section>
      <details className="productCard productAdvanced"><summary><div><strong>Informações avançadas</strong><small>SKU, custo, URL e ordem. A maioria das lojas não precisa alterar isso.</small></div><b>Mostrar</b></summary><div className="productAdvancedGrid">
        <Field label="SKU / código"><input value={draft.sku} onChange={(event) => { setField("sku", event.target.value); }} /></Field>
        <Field label="Custo interno"><input inputMode="decimal" value={draft.cost} onChange={(event) => { setField("cost", event.target.value); }} /></Field>
        <Field label="URL do produto"><input value={draft.slug} onChange={(event) => { setField("slug", slugify(event.target.value)); }} required /></Field>
        <Field label="Ordem no catálogo"><input type="number" min="0" value={draft.position} onChange={(event) => { setField("position", event.target.value); }} /></Field>
      </div></details>
    </main>
    <aside className="productStudioSide">
      <section className="productPublishCard"><div className="productPublishHead"><span className={draft.active ? "productLiveDot isLive" : "productLiveDot"} /><div><strong>{draft.active ? "Visível na loja" : "Oculto da loja"}</strong><small>Você pode mudar isso quando quiser.</small></div></div><Toggle checked={draft.active} title="Mostrar no catálogo" description="O cliente consegue encontrar este produto." onChange={(value) => { setField("active", value); }} /><div className="productInventoryNotice"><strong>Estoque</strong><p>{hasVariants ? "O estoque é controlado por cada combinação de tamanho, cor ou outra opção." : "Use a área Estoque para informar a quantidade disponível."}</p></div></section>
      <section className="productHelpCard"><span>EDIÇÃO</span><strong>Fotos e variações ficam abaixo</strong><p>As informações já cadastradas permanecem enquanto você ajusta o produto.</p></section>
    </aside>
  </div>;
}
