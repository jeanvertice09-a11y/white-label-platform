import { useState } from "react";
import type { FormEvent } from "react";
import type { ProductVariant } from "@white-label/catalog";
import {
  createMerchantVariant,
  updateMerchantVariant,
} from "../../lib/server/catalog-admin.functions.ts";
import { buttonStyle, Card, Field, gridStyle, inputStyle, Money } from "./ui.tsx";

function readPrice(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Preço inválido");
  return Math.round(parsed * 100);
}

function VariantForm(props: {
  productId: string;
  variant?: ProductVariant;
  onSaved: () => void;
}): React.JSX.Element {
  const [status, setStatus] = useState("");
  const variant = props.variant;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("Salvando...");
    try {
      const input = {
        productId: props.productId,
        name: String(form.get("name") ?? "").trim(),
        sku: String(form.get("sku") ?? "").trim() || null,
        attributes: {},
        priceCents: readPrice(form.get("price")),
        compareAtPriceCents: null,
        costCents: null,
        active: form.get("active") === "on",
        stockQuantity: Number(form.get("stockQuantity") ?? 0),
        position: Number(form.get("position") ?? 0),
      };
      if (variant) {
        await updateMerchantVariant({ data: { id: variant.id, input } });
      } else {
        await createMerchantVariant({ data: input });
      }
      setStatus("Salvo.");
      props.onSaved();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao salvar variante.");
    }
  }

  return (
    <form onSubmit={(event) => { void submit(event); }} style={{ display: "grid", gap: 12 }}>
      <div style={gridStyle}>
        <Field label="Nome da variante">
          <input style={inputStyle} name="name" required defaultValue={variant?.name ?? ""} />
        </Field>
        <Field label="SKU">
          <input style={inputStyle} name="sku" defaultValue={variant?.sku ?? ""} />
        </Field>
        <Field label="Preço (R$)">
          <input style={inputStyle} name="price" required inputMode="decimal" defaultValue={((variant?.priceCents ?? 0) / 100).toFixed(2)} />
        </Field>
        <Field label="Estoque">
          <input style={inputStyle} name="stockQuantity" type="number" min={0} defaultValue={variant?.stockQuantity ?? 0} />
        </Field>
        <Field label="Posição">
          <input style={inputStyle} name="position" type="number" min={0} defaultValue={variant?.position ?? 0} />
        </Field>
      </div>
      <label><input name="active" type="checkbox" defaultChecked={variant?.active ?? true} /> Ativa</label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button style={buttonStyle} type="submit">{variant ? "Salvar variante" : "Adicionar variante"}</button>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{status}</span>
      </div>
    </form>
  );
}

export function VariantEditor(props: {
  productId: string;
  variants: ProductVariant[];
}): React.JSX.Element {
  const refresh = (): void => window.location.reload();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <h2 style={{ marginTop: 0 }}>Nova variante</h2>
        <VariantForm productId={props.productId} onSaved={refresh} />
      </Card>
      {props.variants.length === 0 ? null : props.variants.map((variant) => (
        <Card key={variant.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <strong>{variant.name}</strong>
            <span><Money cents={variant.priceCents} /></span>
          </div>
          <VariantForm productId={props.productId} variant={variant} onSaved={refresh} />
        </Card>
      ))}
    </div>
  );
}
