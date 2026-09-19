import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Category, Product, ProductMutationInput } from "@white-label/catalog";
import {
  createMerchantProduct,
  updateMerchantProduct,
} from "../../lib/server/catalog-admin.functions.ts";
import { centsToInput, moneyToCents } from "./format.ts";
import {
  ProductEditorLayout,
  type ProductDraft,
} from "./product-form-layout.tsx";

interface ProductFormProps {
  product: Product | null;
  categories: Category[];
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
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} inválido`);
  }
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

export function ProductForm({
  product,
  categories,
}: ProductFormProps): React.JSX.Element {
  const router = useRouter();
  const [draft, setDraft] = useState(() => initialDraft(product));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  function setField<K extends keyof ProductDraft>(
    key: K,
    value: ProductDraft[K],
  ): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const input = toInput(draft);
      if (product) {
        const updated = await updateMerchantProduct({
          data: { id: product.id, input },
        });
        if (!updated) throw new Error("Produto não encontrado nesta loja");
        setStatus("Produto salvo.");
        await router.invalidate();
      } else {
        const created = await createMerchantProduct({ data: input });
        await router.navigate({
          to: "/admin/products/$id",
          params: { id: created.id },
        });
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="k-editor-form" onSubmit={(event) => { void submit(event); }}>
      <ProductEditorLayout
        draft={draft}
        categories={categories}
        hasVariants={Boolean(product?.variants.length)}
        setField={setField}
      />
      <footer className="k-editor-savebar">
        {status ? <span className="k-status" role="status">{status}</span> : null}
        <button
          className="k-button k-button--primary"
          type="submit"
          disabled={saving}
        >
          {saving ? "Salvando…" : "Salvar produto"}
        </button>
      </footer>
    </form>
  );
}
