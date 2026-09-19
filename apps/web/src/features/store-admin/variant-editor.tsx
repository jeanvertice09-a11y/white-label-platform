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
  compareAt: string;
  cost: string;
  stock: string;
  position: string;
  attributes: string;
  active: boolean;
}

function attributesToText(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function parseAttributes(value: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) {
      throw new Error("Use um atributo por linha no formato atributo=valor");
    }
    const key = line.slice(0, separator).trim();
    const itemValue = line.slice(separator + 1).trim();
    if (!key || key.length > 80 || !itemValue || itemValue.length > 120) {
      throw new Error("Atributo ou valor inválido");
    }
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      throw new Error(`Atributo duplicado: ${key}`);
    }
    attributes[key] = itemValue;
  }
  return attributes;
}

function initialDraft(variant?: ProductVariant): VariantDraft {
  return {
    name: variant?.name ?? "",
    sku: variant?.sku ?? "",
    price: centsToInput(variant?.priceCents ?? 0),
    compareAt: centsToInput(variant?.compareAtPriceCents ?? null),
    cost: centsToInput(variant?.costCents ?? null),
    stock: String(variant?.stockQuantity ?? 0),
    position: String(variant?.position ?? 0),
    attributes: attributesToText(variant?.attributes ?? {}),
    active: variant?.active ?? true,
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

function toInput(productId: string, draft: VariantDraft): VariantMutationInput {
  return {
    productId,
    name: draft.name.trim(),
    sku: draft.sku.trim() || null,
    attributes: parseAttributes(draft.attributes),
    priceCents: moneyToCents(draft.price),
    compareAtPriceCents: optionalCents(draft.compareAt),
    costCents: optionalCents(draft.cost),
    active: draft.active,
    stockQuantity: nonNegativeInteger(draft.stock, "Estoque"),
    position: nonNegativeInteger(draft.position, "Posição"),
  };
}

function VariantFields(props: Readonly<{
  draft: VariantDraft;
  setField: <K extends keyof VariantDraft>(key: K, value: VariantDraft[K]) => void;
}>): React.JSX.Element {
  const { draft, setField } = props;
  return (
    <div className="k-form__grid">
      <div className="k-field">
        <label>Nome da variante</label>
        <input value={draft.name} onChange={(event) => { setField("name", event.target.value); }} required />
      </div>
      <div className="k-field">
        <label>SKU</label>
        <input value={draft.sku} onChange={(event) => { setField("sku", event.target.value); }} />
      </div>
      <div className="k-field">
        <label>Preço</label>
        <input inputMode="decimal" value={draft.price} onChange={(event) => { setField("price", event.target.value); }} required />
      </div>
      <div className="k-field">
        <label>Preço comparativo</label>
        <input inputMode="decimal" value={draft.compareAt} onChange={(event) => { setField("compareAt", event.target.value); }} />
      </div>
      <div className="k-field">
        <label>Custo interno</label>
        <input inputMode="decimal" value={draft.cost} onChange={(event) => { setField("cost", event.target.value); }} />
      </div>
      <div className="k-field">
        <label>Estoque atual</label>
        <input type="number" min="0" value={draft.stock} disabled readOnly />
        <span className="k-muted">Ajuste pela área Estoque.</span>
      </div>
      <div className="k-field">
        <label>Ordem</label>
        <input type="number" min="0" value={draft.position} onChange={(event) => { setField("position", event.target.value); }} />
      </div>
      <div className="k-field k-field--full">
        <label>Atributos</label>
        <textarea value={draft.attributes} onChange={(event) => { setField("attributes", event.target.value); }} placeholder={"tamanho=P\ncor=Azul"} />
        <span className="k-muted">Um por linha em atributo=valor. Combinações duplicadas continuam bloqueadas.</span>
      </div>
    </div>
  );
}

function VariantSummary({ variant }: Readonly<{
  variant?: ProductVariant;
}>): React.JSX.Element {
  const label = variant ? variant.name : "Adicionar variante";
  return (
    <summary>
      <span>
        <strong>{label}</strong>
        {variant ? <small>{variant.sku ?? "Sem SKU"} · estoque {variant.stockQuantity}</small> : <small>Preço, SKU e atributos próprios</small>}
      </span>
      {variant ? <span className={variant.active ? "k-status-pill k-status-pill--active" : "k-status-pill"}>{variant.active ? "Ativa" : "Inativa"}</span> : null}
    </summary>
  );
}

function VariantForm(props: Readonly<{
  productId: string;
  variant?: ProductVariant;
}>): React.JSX.Element {
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
      const input = toInput(props.productId, draft);
      if (props.variant) {
        const updated = await updateMerchantVariant({ data: { id: props.variant.id, input } });
        if (!updated) throw new Error("Variante não encontrada neste produto");
      } else {
        await createMerchantVariant({ data: input });
      }
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
    <details className="k-record-editor" open={!props.variant}>
      <VariantSummary variant={props.variant} />
      <form className="k-record-editor__form" onSubmit={(event) => { void submit(event); }}>
        <VariantFields draft={draft} setField={setField} />
        <div className="k-record-editor__footer">
          <label className="k-check"><input type="checkbox" checked={draft.active} onChange={(event) => { setField("active", event.target.checked); }} />Variante ativa</label>
          {status ? <span className="k-status" role="status">{status}</span> : null}
          <button className="k-button" type="submit" disabled={saving}>{saving ? "Salvando…" : props.variant ? "Salvar variante" : "Adicionar variante"}</button>
        </div>
      </form>
    </details>
  );
}

export function VariantEditor(props: Readonly<{
  productId: string;
  variants: ProductVariant[];
}>): React.JSX.Element {
  return (
    <section className="k-workspace-section">
      <header className="k-section-head">
        <div>
          <span className="k-section-kicker">Opções</span>
          <h2>Variantes</h2>
          <p>Cada opção mantém preço, SKU, disponibilidade e estoque próprios.</p>
        </div>
        <span className="k-section-count">{props.variants.length} cadastrada(s)</span>
      </header>
      <div className="k-record-list">
        <VariantForm productId={props.productId} />
        {props.variants.map((variant) => (
          <VariantForm key={variant.id} productId={props.productId} variant={variant} />
        ))}
      </div>
    </section>
  );
}
