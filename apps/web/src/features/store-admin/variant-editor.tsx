import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { ProductVariant } from "@white-label/catalog";
import {
  createMerchantVariant,
  updateMerchantVariant,
} from "../../lib/server/catalog-admin.functions.ts";
import { centsToInput, moneyToCents } from "./format.ts";

interface VariantFormProps {
  productId: string;
  variant?: ProductVariant;
}

function VariantForm({ productId, variant }: VariantFormProps) {
  const router = useRouter();
  const [name, setName] = useState(variant?.name ?? "");
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [price, setPrice] = useState(centsToInput(variant?.priceCents ?? 0));
  const [stock, setStock] = useState(String(variant?.stockQuantity ?? 0));
  const [attribute, setAttribute] = useState(Object.keys(variant?.attributes ?? {})[0] ?? "");
  const [value, setValue] = useState(Object.values(variant?.attributes ?? {})[0] ?? "");
  const [active, setActive] = useState(variant?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    const input = {
      productId,
      name: name.trim(),
      sku: sku.trim() || null,
      attributes: attribute.trim() && value.trim() ? { [attribute.trim()]: value.trim() } : {},
      priceCents: moneyToCents(price),
      compareAtPriceCents: variant?.compareAtPriceCents ?? null,
      costCents: variant?.costCents ?? null,
      active,
      stockQuantity: Number.parseInt(stock || "0", 10),
      position: variant?.position ?? 0,
    };
    try {
      if (variant) {
        await updateMerchantVariant({ data: { id: variant.id, input } });
      } else {
        await createMerchantVariant({ data: input });
        setName("");
        setSku("");
        setPrice("0,00");
        setStock("0");
        setAttribute("");
        setValue("");
      }
      setStatus("Variante salva.");
      await router.invalidate();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar a variante.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="k-card k-form" onSubmit={(event) => void submit(event)}>
      <div className="k-form__grid">
        <div className="k-field">
          <label>Nome da variante</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: P, Azul" required />
        </div>
        <div className="k-field">
          <label>SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div className="k-field">
          <label>Preço</label>
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        <div className="k-field">
          <label>Estoque</label>
          <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
        <div className="k-field">
          <label>Atributo</label>
          <input value={attribute} onChange={(e) => setAttribute(e.target.value)} placeholder="Ex.: tamanho" />
        </div>
        <div className="k-field">
          <label>Valor</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: P" />
        </div>
      </div>
      <label className="k-check">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Variante ativa
      </label>
      <div className="k-actions">
        {status ? <span className="k-status">{status}</span> : null}
        <button className="k-button" type="submit" disabled={saving}>
          {saving ? "Salvando…" : variant ? "Atualizar variante" : "Adicionar variante"}
        </button>
      </div>
    </form>
  );
}

export function VariantEditor(props: Readonly<{
  productId: string;
  variants: ProductVariant[];
}>) {
  return (
    <section className="k-page">
      <div>
        <h2>Variantes</h2>
        <p className="k-muted">Cada variante mantém seu próprio preço e estoque.</p>
      </div>
      <VariantForm productId={props.productId} />
      {props.variants.length ? (
        <div className="k-stack">
          {props.variants.map((variant) => (
            <VariantForm key={variant.id} productId={props.productId} variant={variant} />
          ))}
        </div>
      ) : (
        <div className="k-empty">Nenhuma variante cadastrada.</div>
      )}
    </section>
  );
}
