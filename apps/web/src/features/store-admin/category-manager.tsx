import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Category } from "@white-label/catalog";
import {
  createMerchantCategory,
  updateMerchantCategory,
} from "../../lib/server/catalog-admin.functions.ts";
import { slugify } from "./format.ts";

interface CategoryEditorProps {
  categories: Category[];
  category?: Category;
}

function CategoryForm({ categories, category }: CategoryEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [active, setActive] = useState(category?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  function changeName(value: string): void {
    setName(value);
    if (!category && (!slug || slug === slugify(name))) setSlug(slugify(value));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    const input = {
      name: name.trim(),
      slug: slug.trim(),
      description: category?.description ?? null,
      parentId: parentId || null,
      active,
      position: category?.position ?? 0,
    };
    try {
      if (category) {
        await updateMerchantCategory({ data: { id: category.id, input } });
      } else {
        await createMerchantCategory({ data: input });
        setName("");
        setSlug("");
        setParentId("");
      }
      setStatus("Categoria salva.");
      await router.invalidate();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="k-card k-form" onSubmit={(event) => void submit(event)}>
      <div className="k-form__grid">
        <div className="k-field">
          <label>Nome</label>
          <input value={name} onChange={(e) => changeName(e.target.value)} required />
        </div>
        <div className="k-field">
          <label>Slug</label>
          <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
        </div>
        <div className="k-field">
          <label>Categoria principal</label>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Nenhuma</option>
            {categories
              .filter((item) => item.id !== category?.id)
              .map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
          </select>
        </div>
        <label className="k-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Categoria ativa
        </label>
      </div>
      <div className="k-actions">
        {status ? <span className="k-status">{status}</span> : null}
        <button className="k-button" type="submit" disabled={saving}>
          {saving ? "Salvando…" : category ? "Atualizar" : "Criar categoria"}
        </button>
      </div>
    </form>
  );
}

export function CategoryManager({ categories }: Readonly<{ categories: Category[] }>) {
  return (
    <div className="k-page">
      <CategoryForm categories={categories} />
      {categories.length ? (
        <div className="k-stack">
          {categories.map((category) => (
            <CategoryForm key={category.id} categories={categories} category={category} />
          ))}
        </div>
      ) : (
        <div className="k-empty">Nenhuma categoria cadastrada.</div>
      )}
    </div>
  );
}
