import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Category, Product, ProductMutationInput } from "@white-label/catalog";
import {
  createMerchantProduct,
  updateMerchantProduct,
} from "../../lib/server/catalog-admin.functions.ts";
import { centsToInput, moneyToCents, slugify } from "./format.ts";

interface ProductFormProps {
  product: Product | null;
  categories: Category[];
}

interface ProductDraft {
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

function initialDraft(product: Product | null): ProductDraft {
  return {
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    sku: product?.sku ?? "",
    categoryId: product?.categoryId ?? "",
    price: centsToInput(product?.priceCents ?? 0),
    compareAt: centsToInput(product?.compareAtPriceCents ?? null),
    cost: centsToInput(product?.costCents ?? null),
    stock: String(product?.stockQuantity ?? 0),
    position: String(product?.position ?? 0),
    active: product?.active ?? true,
    trackInventory: product?.trackInventory ?? false,
  };
}

function optionalCents(value: string): number | null {
  return value.trim() ? moneyToCents(value) : null;
}

function nonNegativeInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value || "0", 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} inválido`);
  return parsed;
}

function toInput(draft: ProductDraft): ProductMutationInput {
  return {
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    description: draft.description.trim() || null,
    sku: draft.sku.trim() || null,
    categoryId: draft.categoryId || null,
    priceCents: moneyToCents(draft.price),
    compareAtPriceCents: optionalCents(draft.compareAt),
    costCents: optionalCents(draft.cost),
    active: draft.active,
    trackInventory: draft.trackInventory,
    stockQuantity: nonNegativeInteger(draft.stock, "Estoque"),
    position: nonNegativeInteger(draft.position, "Posição"),
  };
}

function ProductFields(props: Readonly<{
  draft: ProductDraft;
  categories: Category[];
  hasVariants: boolean;
  setField: <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => void;
}>): React.JSX.Element {
  const { draft, categories, hasVariants, setField } = props;
  return (
    <div className="k-card k-form__grid">
      <div className="k-field"><label htmlFor="product-name">Nome</label>
        <input id="product-name" value={draft.name} onChange={(event) => { setField("name", event.target.value); }} required />
      </div>
      <div className="k-field"><label htmlFor="product-slug">Slug</label>
        <input id="product-slug" value={draft.slug} onChange={(event) => { setField("slug", slugify(event.target.value)); }} required />
      </div>
      <div className="k-field k-field--full"><label htmlFor="product-description">Descrição</label>
        <textarea id="product-description" value={draft.description} onChange={(event) => { setField("description", event.target.value); }} />
      </div>
      <div className="k-field"><label htmlFor="product-sku">SKU</label>
        <input id="product-sku" value={draft.sku} onChange={(event) => { setField("sku", event.target.value); }} />
      </div>
      <div className="k-field"><label htmlFor="product-category">Categoria</label>
        <select id="product-category" value={draft.categoryId} onChange={(event) => { setField("categoryId", event.target.value); }}>
          <option value="">Sem categoria</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.active ? "" : " (inativa)"}</option>)}
        </select>
      </div>
      <div className="k-field"><label htmlFor="product-price">Preço base</label>
        <input id="product-price" inputMode="decimal" value={draft.price} onChange={(event) => { setField("price", event.target.value); }} required />
      </div>
      <div className="k-field"><label htmlFor="product-compare">Preço comparativo</label>
        <input id="product-compare" inputMode="decimal" value={draft.compareAt} onChange={(event) => { setField("compareAt", event.target.value); }} />
      </div>
      <div className="k-field"><label htmlFor="product-cost">Custo</label>
        <input id="product-cost" inputMode="decimal" value={draft.cost} onChange={(event) => { setField("cost", event.target.value); }} />
      </div>
      <div className="k-field"><label htmlFor="product-stock">Estoque atual</label>
        <input id="product-stock" type="number" min="0" value={draft.stock} disabled readOnly />
        <span className="k-muted">Ajuste o saldo pela tela Estoque para manter o histórico de movimentações.</span>
      </div>
      <div className="k-field"><label htmlFor="product-position">Ordem</label>
        <input id="product-position" type="number" min="0" value={draft.position} onChange={(event) => { setField("position", event.target.value); }} />
      </div>
      <label className="k-check"><input type="checkbox" checked={draft.active} onChange={(event) => { setField("active", event.target.checked); }} />Produto ativo</label>
      <label className="k-check"><input type="checkbox" checked={draft.trackInventory} onChange={(event) => { setField("trackInventory", event.target.checked); }} />Controlar estoque</label>
      {hasVariants ? <div className="k-field k-field--full"><span className="k-muted">Este produto possui variantes; preço e estoque de cada seleção são definidos nas variantes abaixo.</span></div> : null}
    </div>
  );
}

export function ProductForm({ product, categories }: ProductFormProps): React.JSX.Element {
  const router = useRouter();
  const [draft, setDraft] = useState(() => initialDraft(product));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  function setField<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const input = toInput(draft);
      if (product) {
        const updated = await updateMerchantProduct({ data: { id: product.id, input } });
        if (!updated) throw new Error("Produto não encontrado nesta loja");
        setStatus("Produto salvo.");
        await router.invalidate();
      } else {
        const created = await createMerchantProduct({ data: input });
        await router.navigate({ to: "/admin/products/$id", params: { id: created.id } });
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="k-form" onSubmit={(event) => { void submit(event); }}>
      <ProductFields
        draft={draft}
        categories={categories}
        hasVariants={Boolean(product?.variants.length)}
        setField={setField}
      />
      <div className="k-actions">
        {status ? <span className="k-status">{status}</span> : null}
        <button className="k-button k-button--primary" type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar produto"}
        </button>
      </div>
    </form>
  );
}
