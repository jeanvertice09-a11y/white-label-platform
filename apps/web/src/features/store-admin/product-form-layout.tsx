import type { ReactNode } from "react";
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

type SetField = <K extends keyof ProductDraft>(
  key: K,
  value: ProductDraft[K],
) => void;

function EditorSection(props: Readonly<{
  title: string;
  description: string;
  children: ReactNode;
}>): React.JSX.Element {
  return (
    <section className="k-editor-section">
      <header className="k-editor-section__head">
        <h2>{props.title}</h2>
        <p>{props.description}</p>
      </header>
      <div className="k-editor-section__body">{props.children}</div>
    </section>
  );
}

function MainFields(props: Readonly<{
  draft: ProductDraft;
  hasVariants: boolean;
  setField: SetField;
}>): React.JSX.Element {
  const { draft, hasVariants, setField } = props;
  return (
    <div className="k-editor-main">
      <EditorSection
        title="Informações principais"
        description="O conteúdo que identifica o produto para o cliente."
      >
        <div className="k-field">
          <label htmlFor="product-name">Nome</label>
          <input
            id="product-name"
            value={draft.name}
            onChange={(event) => { setField("name", event.target.value); }}
            required
          />
        </div>
        <div className="k-field">
          <label htmlFor="product-slug">Endereço público</label>
          <input
            id="product-slug"
            value={draft.slug}
            onChange={(event) => {
              setField("slug", slugify(event.target.value));
            }}
            required
          />
        </div>
        <div className="k-field k-field--full">
          <label htmlFor="product-description">Descrição</label>
          <textarea
            id="product-description"
            value={draft.description}
            onChange={(event) => {
              setField("description", event.target.value);
            }}
            placeholder="Descreva o produto com clareza."
          />
        </div>
      </EditorSection>

      <EditorSection
        title="Preço"
        description={
          hasVariants
            ? "Valores base. Cada variante continua com seu próprio preço."
            : "Preço de venda, comparativo e custo interno."
        }
      >
        <div className="k-field">
          <label htmlFor="product-price">Preço base</label>
          <input
            id="product-price"
            inputMode="decimal"
            value={draft.price}
            onChange={(event) => { setField("price", event.target.value); }}
            required
          />
        </div>
        <div className="k-field">
          <label htmlFor="product-compare">Preço comparativo</label>
          <input
            id="product-compare"
            inputMode="decimal"
            value={draft.compareAt}
            onChange={(event) => {
              setField("compareAt", event.target.value);
            }}
          />
        </div>
        <div className="k-field">
          <label htmlFor="product-cost">Custo</label>
          <input
            id="product-cost"
            inputMode="decimal"
            value={draft.cost}
            onChange={(event) => { setField("cost", event.target.value); }}
          />
          <span className="k-muted">Interno. Nunca é exibido no storefront.</span>
        </div>
      </EditorSection>
    </div>
  );
}

function ContextFields(props: Readonly<{
  draft: ProductDraft;
  categories: Category[];
  hasVariants: boolean;
  setField: SetField;
}>): React.JSX.Element {
  const { draft, categories, hasVariants, setField } = props;
  return (
    <aside className="k-editor-aside" aria-label="Publicação e organização">
      <section className="k-context-section">
        <h2>Publicação</h2>
        <label className="k-switch-row">
          <span>
            <strong>Produto ativo</strong>
            <small>Visível quando as regras públicas permitirem.</small>
          </span>
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => {
              setField("active", event.target.checked);
            }}
          />
        </label>
        <label className="k-switch-row">
          <span>
            <strong>Controlar estoque</strong>
            <small>Movimentações continuam registradas no ledger.</small>
          </span>
          <input
            type="checkbox"
            checked={draft.trackInventory}
            onChange={(event) => {
              setField("trackInventory", event.target.checked);
            }}
          />
        </label>
      </section>

      <section className="k-context-section">
        <h2>Organização</h2>
        <div className="k-field">
          <label htmlFor="product-sku">SKU</label>
          <input
            id="product-sku"
            value={draft.sku}
            onChange={(event) => { setField("sku", event.target.value); }}
          />
        </div>
        <div className="k-field">
          <label htmlFor="product-category">Categoria</label>
          <select
            id="product-category"
            value={draft.categoryId}
            onChange={(event) => {
              setField("categoryId", event.target.value);
            }}
          >
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}{category.active ? "" : " (inativa)"}
              </option>
            ))}
          </select>
        </div>
        <div className="k-field">
          <label htmlFor="product-position">Ordem no catálogo</label>
          <input
            id="product-position"
            type="number"
            min="0"
            value={draft.position}
            onChange={(event) => {
              setField("position", event.target.value);
            }}
          />
        </div>
      </section>

      <section className="k-context-section">
        <h2>Estoque</h2>
        <div className="k-context-value">
          <span>Saldo atual</span>
          <strong>{draft.stock}</strong>
        </div>
        <p className="k-muted">
          Ajuste o saldo em Estoque para preservar o histórico.
          {hasVariants ? " Variantes mantêm saldos próprios." : ""}
        </p>
      </section>
    </aside>
  );
}

export function ProductEditorLayout(props: Readonly<{
  draft: ProductDraft;
  categories: Category[];
  hasVariants: boolean;
  setField: SetField;
}>): React.JSX.Element {
  return (
    <div className="k-editor-layout">
      <MainFields
        draft={props.draft}
        hasVariants={props.hasVariants}
        setField={props.setField}
      />
      <ContextFields
        draft={props.draft}
        categories={props.categories}
        hasVariants={props.hasVariants}
        setField={props.setField}
      />
    </div>
  );
}
