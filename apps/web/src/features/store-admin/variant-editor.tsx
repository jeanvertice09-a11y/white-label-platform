import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { ProductVariant, VariantMutationInput } from "@white-label/catalog";
import {
  createMerchantVariant,
  updateMerchantVariant,
} from "../../lib/server/catalog-admin.functions.ts";
import { centsToInput, moneyToCents } from "./format.ts";

interface VariantDraft {
  name: string;
  sku: string;
  price: string;
  stock: string;
  attribute: string;
  value: string;
  active: boolean;
}

function initialDraft(variant?: ProductVariant): VariantDraft {
  const attributes = variant?.attributes ?? {};
  return {
    name: variant?.name ?? "",
    sku: variant?.sku ?? "",
    price: centsToInput(variant?.priceCents ?? 0),
    stock: String(variant?.stockQuantity ?? 0),
    attribute: Object.keys(attributes)[0] ?? "",
    value: Object.values(attributes)[0] ?? "",
    active: variant?.active ?? true,
  };
}

function toInput(productId: string, draft: VariantDraft, variant?: ProductVariant): VariantMutationInput {
  const key = draft.attribute.trim();
  const value = draft.value.trim();
  return {
    productId,
    name: draft.name.trim(),
    sku: draft.sku.trim() || null,
    attributes: key && value ? { [key]: value } : {},
    priceCents: moneyToCents(draft.price),
    compareAtPriceCents: variant?.compareAtPriceCents ?? null,
    costCents: variant?.costCents ?? null,
    active: draft.active,
    stockQuantity: Number.parseInt(draft.stock || "0", 10),
    position: variant?.position ?? 0,
  };
}

function VariantFields(props: Readonly<{
  draft: VariantDraft;
  setField: <K extends keyof VariantDraft>(key: K, value: VariantDraft[K]) => void;
}>): React.JSX.Element {
  const { draft, setField } = props;
  return (
    <div className="k-form__grid">
      <div className="k-field"><label>Nome da variante</label><input value={draft.name} onChange={(event) => { setField("name", event.target.value); }} required /></div>
      <div className="k-field"><label>SKU</label><input value={draft.sku} onChange={(event) => { setField("sku", event.target.value); }} /></div>
      <div className="k-field"><label>Preço</label><input inputMode="decimal" value={draft.price} onChange={(event) => { setField("price", event.target.value); }} required /></div>
      <div className="k-field"><label>Estoque</label><input type="number" min="0" value={draft.stock} onChange={(event) => { setField("stock", event.target.value); }} /></div>
      <div className="k-field"><label>Atributo</label><input value={draft.attribute} onChange={(event) => { setField("attribute", event.target.value); }} placeholder="Ex.: tamanho" /></div>
      <div className="k-field"><label>Valor</label><input value={draft.value} onChange={(event) => { setField("value", event.target.value); }} placeholder="Ex.: P" /></div>
    </div>
  );
}

function VariantForm(props: Readonly<{ productId: string; variant?: ProductVariant }>): React.JSX.Element {
  const router = useRouter();
  const [draft, setDraft] = useState(() => initialDraft(props.variant));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  function setField<K extends keyof VariantDraft>(key: K, value: VariantDraft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const input = toInput(props.productId, draft, props.variant);
      if (props.variant) await updateMerchantVariant({ data: { id: props.variant.id, input } });
      else await createMerchantVariant({ data: input });
      setStatus("Variante salva.");
      await router.invalidate();
      if (!props.variant) setDraft(initialDraft());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar a variante.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="k-card k-form" onSubmit={(event) => { void submit(event); }}>
      <VariantFields draft={draft} setField={setField} />
      <label className="k-check"><input type="checkbox" checked={draft.active} onChange={(event) => { setField("active", event.target.checked); }} />Variante ativa</label>
      <div className="k-actions">
        {status ? <span className="k-status">{status}</span> : null}
        <button className="k-button" type="submit" disabled={saving}>{saving ? "Salvando…" : props.variant ? "Atualizar variante" : "Adicionar variante"}</button>
      </div>
    </form>
  );
}

export function VariantEditor(props: Readonly<{ productId: string; variants: ProductVariant[] }>): React.JSX.Element {
  return (
    <section className="k-page">
      <div><h2>Variantes</h2><p className="k-muted">Cada variante mantém seu próprio preço e estoque.</p></div>
      <VariantForm productId={props.productId} />
      {props.variants.length ? (
        <div className="k-stack">{props.variants.map((variant) => <VariantForm key={variant.id} productId={props.productId} variant={variant} />)}</div>
      ) : <div className="k-empty">Nenhuma variante cadastrada.</div>}
    </section>
  );
}
