import { useState } from "react";
import type { FormEvent } from "react";
import type { Category } from "@white-label/catalog";
import {
  createMerchantCategory,
  updateMerchantCategory,
} from "../../lib/server/catalog-admin.functions.ts";
import { buttonStyle, Card, EmptyState, Field, gridStyle, inputStyle } from "./ui.tsx";

function CategoryForm(props: {
  category?: Category;
  categories: Category[];
}): React.JSX.Element {
  const [status, setStatus] = useState("");
  const category = props.category;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("Salvando...");
    try {
      const input = {
        name: String(form.get("name") ?? "").trim(),
        slug: String(form.get("slug") ?? "").trim(),
        description: String(form.get("description") ?? "").trim() || null,
        parentId: String(form.get("parentId") ?? "").trim() || null,
        active: form.get("active") === "on",
        position: Number(form.get("position") ?? 0),
      };
      if (category) {
        await updateMerchantCategory({ data: { id: category.id, input } });
      } else {
        await createMerchantCategory({ data: input });
      }
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao salvar categoria.");
    }
  }

  return (
    <form onSubmit={(event) => { void submit(event); }} style={{ display: "grid", gap: 12 }}>
      <div style={gridStyle}>
        <Field label="Nome">
          <input style={inputStyle} name="name" required defaultValue={category?.name ?? ""} />
        </Field>
        <Field label="Slug">
          <input style={inputStyle} name="slug" required defaultValue={category?.slug ?? ""} />
        </Field>
        <Field label="Categoria pai">
          <select style={inputStyle} name="parentId" defaultValue={category?.parentId ?? ""}>
            <option value="">Nenhuma</option>
            {props.categories.filter((item) => item.id !== category?.id).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Posição">
          <input style={inputStyle} name="position" type="number" min={0} defaultValue={category?.position ?? 0} />
        </Field>
      </div>
      <Field label="Descrição">
        <input style={inputStyle} name="description" defaultValue={category?.description ?? ""} />
      </Field>
      <label><input name="active" type="checkbox" defaultChecked={category?.active ?? true} /> Ativa</label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button style={buttonStyle} type="submit">{category ? "Salvar" : "Criar categoria"}</button>
        <span style={{ color: "#6b7280", fontSize: 13 }}>{status}</span>
      </div>
    </form>
  );
}

export function CategoriesPanel(props: { categories: Category[] }): React.JSX.Element {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <h2 style={{ marginTop: 0 }}>Nova categoria</h2>
        <CategoryForm categories={props.categories} />
      </Card>
      {props.categories.length === 0 ? (
        <Card><EmptyState title="Nenhuma categoria" text="Crie a primeira categoria da sua loja." /></Card>
      ) : props.categories.map((category) => (
        <Card key={category.id}>
          <CategoryForm category={category} categories={props.categories} />
        </Card>
      ))}
    </div>
  );
}
