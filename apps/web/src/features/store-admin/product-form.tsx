import { useState } from "react";
import type { FormEvent } from "react";
import type { Category, Product } from "@white-label/catalog";
import {
  createMerchantProduct,
  updateMerchantProduct,
} from "../../lib/server/catalog-admin.functions.ts";
import { buttonStyle, Card, Field, gridStyle, inputStyle } from "./ui.tsx";

function cents(value: FormDataEntryValue | null): number {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Valor inválido");
  return Math.round(parsed * 100);
}

function optionalCents(value: FormDataEntryValue | null): number | null {
  if (!String(value ?? "").trim()) return null;
  return cents(value);
}

export function ProductForm(props: {
  product?: Product;
  categories: Category[];
}): React.JSX.Element {
  const [status, setStatus] = useState("");
  const product = props.product;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus("Salvando...");
    const form = new FormData(event.currentTarget);
    try {
      const input = {
        name: String(form.get("name") ?? "").trim(),
        slug: String(form.get("slug") ?? "").trim(),
        description: String(form.get("description") ?? "").trim() || null,
        sku: String(form.get("sku") ?? "").trim() || null,
        categoryId: String(form.get("categoryId") ?? "").trim() || null,
        priceCents: cents(form.get("price")),
        compareAtPriceCents: optionalCents(form.get("compareAtPrice")),
        costCents: optionalCents(form.get("cost")),
        active: form.get("active") === "on",
        trackInventory: form.get("trackInventory") === "on",
        stockQuantity: Number(form.get("stockQuantity") ?? 0),
        position: Number(form.get("position") ?? 0),
      };
      if (product) {
        const saved = await updateMerchantProduct({ data: { id: product.id, input } });
        if (!saved) throw new Error("Produto não encontrado");
        setStatus("Produto salvo.");
      } else {
        const saved = await createMerchantProduct({ data: input });
        window.location.assign("/admin/products/" + saved.id);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card>
      <form onSubmit={(event) => { void submit(event); }} style={{ display: "grid", gap: 18 }}>
        <div style={gridStyle}>
          <Field label="Nome">
            <input style={inputStyle} name="name" required maxLength={160} defaultValue={product?.name ?? ""} />
          </Field>
          <Field label="Slug" hint="Ex.: camiseta-basica">
            <input style={inputStyle} name="slug" required maxLength={180} defaultValue={product?.slug ?? ""} />
          </Field>
          <Field label="SKU">
            <input style={inputStyle} name="sku" maxLength={180} defaultValue={product?.sku ?? ""} />
          </Field>
          <Field label="Categoria">
            <select style={inputStyle} name="categoryId" defaultValue={product?.categoryId ?? ""}>
              <option value="">Sem categoria</option>
              {props.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Descrição">
          <textarea
            style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
            name="description"
            defaultValue={product?.description ?? ""}
          />
        </Field>

        <div style={gridStyle}>
          <Field label="Preço (R$)">
            <input style={inputStyle} name="price" inputMode="decimal" required defaultValue={((product?.priceCents ?? 0) / 100).toFixed(2)} />
          </Field>
          <Field label="Preço comparativo (R$)">
            <input style={inputStyle} name="compareAtPrice" inputMode="decimal" defaultValue={product?.compareAtPriceCents === null || product?.compareAtPriceCents === undefined ? "" : (product.compareAtPriceCents / 100).toFixed(2)} />
          </Field>
          <Field label="Custo (R$)">
            <input style={inputStyle} name="cost" inputMode="decimal" defaultValue={product?.costCents === null || product?.costCents === undefined ? "" : (product.costCents / 100).toFixed(2)} />
          </Field>
          <Field label="Estoque">
            <input style={inputStyle} name="stockQuantity" type="number" min={0} defaultValue={product?.stockQuantity ?? 0} />
          </Field>
          <Field label="Posição">
            <input style={inputStyle} name="position" type="number" min={0} defaultValue={product?.position ?? 0} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <label><input name="active" type="checkbox" defaultChecked={product?.active ?? true} /> Ativo</label>
          <label><input name="trackInventory" type="checkbox" defaultChecked={product?.trackInventory ?? false} /> Controlar estoque</label>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button style={buttonStyle} type="submit">Salvar produto</button>
          <span style={{ color: "#6b7280", fontSize: 14 }}>{status}</span>
        </div>
      </form>
    </Card>
  );
}
