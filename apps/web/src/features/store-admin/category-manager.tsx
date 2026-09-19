import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Category, CategoryMutationInput } from "@white-label/catalog";
import {
  createMerchantCategory,
  updateMerchantCategory,
} from "../../lib/server/catalog-admin.functions.ts";
import { slugify } from "./format.ts";

interface CategoryDraft {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  position: string;
  active: boolean;
}

function initialDraft(category?: Category): CategoryDraft {
  return {
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    parentId: category?.parentId ?? "",
    position: String(category?.position ?? 0),
    active: category?.active ?? true,
  };
}

function toInput(draft: CategoryDraft): CategoryMutationInput {
  const position = Number.parseInt(draft.position || "0", 10);
  if (!Number.isSafeInteger(position) || position < 0) throw new Error("Ordem inválida");
  return {
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    description: draft.description.trim() || null,
    parentId: draft.parentId || null,
    active: draft.active,
    position,
  };
}

function CategoryFields(props: Readonly<{
  draft: CategoryDraft;
  categories: Category[];
  category?: Category;
  setField: <K extends keyof CategoryDraft>(key: K, value: CategoryDraft[K]) => void;
}>): React.JSX.Element {
  return (
    <div className="k-form__grid">
      <div className="k-field"><label>Nome</label><input value={props.draft.name} onChange={(event) => { props.setField("name", event.target.value); }} required /></div>
      <div className="k-field"><label>Slug</label><input value={props.draft.slug} onChange={(event) => { props.setField("slug", slugify(event.target.value)); }} required /></div>
      <div className="k-field k-field--full"><label>Descrição</label><textarea value={props.draft.description} onChange={(event) => { props.setField("description", event.target.value); }} /></div>
      <div className="k-field">
        <label>Categoria principal</label>
        <select value={props.draft.parentId} onChange={(event) => { props.setField("parentId", event.target.value); }}>
          <option value="">Nenhuma</option>
          {props.categories
            .filter((item) => item.id !== props.category?.id)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}{item.active ? "" : " (inativa)"}
              </option>
            ))}
        </select>
      </div>
      <div className="k-field"><label>Ordem</label><input type="number" min="0" value={props.draft.position} onChange={(event) => { props.setField("position", event.target.value); }} /></div>
      <label className="k-check"><input type="checkbox" checked={props.draft.active} onChange={(event) => { props.setField("active", event.target.checked); }} />Categoria ativa</label>
    </div>
  );
}

function CategoryForm(props: Readonly<{
  categories: Category[];
  category?: Category;
}>): React.JSX.Element {
  const router = useRouter();
  const [draft, setDraft] = useState(() => initialDraft(props.category));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  function setField<K extends keyof CategoryDraft>(
    key: K,
    value: CategoryDraft[K],
  ): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const input = toInput(draft);
      if (props.category) {
        const updated = await updateMerchantCategory({
          data: { id: props.category.id, input },
        });
        if (!updated) throw new Error("Categoria não encontrada nesta loja");
      } else {
        await createMerchantCategory({ data: input });
      }
      setStatus("Categoria salva.");
      await router.invalidate();
      if (!props.category) setDraft(initialDraft());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="k-record-editor__form" onSubmit={(event) => { void submit(event); }}>
      <CategoryFields
        draft={draft}
        categories={props.categories}
        category={props.category}
        setField={setField}
      />
      <div className="k-record-editor__footer">
        {status ? <span className="k-status">{status}</span> : null}
        <button className="k-button" type="submit" disabled={saving}>
          {saving ? "Salvando…" : props.category ? "Salvar categoria" : "Criar categoria"}
        </button>
      </div>
    </form>
  );
}

export function CategoryManager({
  categories,
}: Readonly<{ categories: Category[] }>): React.JSX.Element {
  return (
    <section className="k-workspace-section">
      <header className="k-section-head">
        <div>
          <span className="k-section-kicker">Organização</span>
          <h2>Estrutura do catálogo</h2>
          <p>Crie categorias e organize a navegação pública sem empilhar formulários abertos.</p>
        </div>
        <span className="k-section-count">{categories.length} categoria(s)</span>
      </header>
      <details className="k-composer">
        <summary>
          <span><strong>Nova categoria</strong><small>Nome, hierarquia e ordem.</small></span>
          <span className="k-composer__action">Adicionar</span>
        </summary>
        <div className="k-composer__body">
          <CategoryForm categories={categories} />
        </div>
      </details>
      {categories.length ? (
        <div className="k-record-list">
          {categories.map((category) => (
            <details className="k-record-editor" key={category.id}>
              <summary>
                <span>
                  <strong>{category.name}</strong>
                  <small>/{category.slug}{category.parentId ? " · subcategoria" : " · categoria principal"}</small>
                </span>
                <span className={category.active ? "k-status-pill k-status-pill--active" : "k-status-pill"}>
                  {category.active ? "Ativa" : "Inativa"}
                </span>
              </summary>
              <CategoryForm categories={categories} category={category} />
            </details>
          ))}
        </div>
      ) : (
        <div className="k-inline-state">
          <strong>Nenhuma categoria cadastrada</strong>
          <span>Use “Nova categoria” para começar a organizar o catálogo.</span>
        </div>
      )}
    </section>
  );
}
