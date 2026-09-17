import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Category, Product } from "@white-label/catalog";
import {
  createMerchantProduct,
  updateMerchantProduct,
} from "../../lib/server/catalog-admin.functions.ts";
import { centsToInput, moneyToCents, slugify } from "./format.ts";

interface ProductFormProps {
  product: Product | null;
  categories: Category[];
}

function optionalCents(value: string): number | null {
  return value.trim() ? moneyToCents(value) : null;
}

export function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [price, setPrice] = useState(centsToInput(product?.priceCents ?? 0));
  const [compareAt, setCompareAt] = useState(centsToInput(product?.compareAtPriceCents ?? null));
  const [cost, setCost] = useState(centsToInput(product?.costCents ?? null));
  const [stock, setStock] = useState(String(product?.stockQuantity ?? 0));
  const [active, setActive] = useState(product?.active ?? true);
  const [trackInventory, setTrackInventory] = useState(product?.trackInventory ?? false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  function changeName(value: string): void {
    setName(value);
    if (!product && (!slug || slug === slugify(name))) setSlug(slugify(value));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const input = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        sku: sku.trim() || null,
        categoryId: categoryId || null,
        priceCents: moneyToCents(price),
        compareAtPriceCents: optionalCents(compareAt),
        costCents: optionalCents(cost),
        active,
        trackInventory,
        stockQuantity: Number.parseInt(stock || "0", 10),
        position: product?.position ?? 0,
      };
      if (product) {
        await updateMerchantProduct({ data: { id: product.id, input } });
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
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="k-form" onSubmit={(event) => void submit(event)}>
      <div className="k-card k-form__grid">
        <div className="k-field">
          <label htmlFor="product-name">Nome</label>
          <input id="product-name" value={name} onChange={(e) => changeName(e.target.value)} required />
        </div>
        <div className="k-field">
          <label htmlFor="product-slug">Slug</label>
          <input id="product-slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
        </div>
        <div className="k-field k-field--full">
          <label htmlFor="product-description">Descrição</label>
          <textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="k-field">
          <label htmlFor="product-sku">SKU</label>
          <input id="product-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div className="k-field">
          <label htmlFor="product-category">Categoria</label>
          <select id="product-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <div className="k-field">
          <label htmlFor="product-price">Preço</label>
          <input id="product-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        <div className="k-field">
          <label htmlFor="product-compare">Preço comparativo</label>
          <input id="product-compare" inputMode="decimal" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} />
        </div>
        <div className="k-field">
          <label htmlFor="product-cost">Custo</label>
          <input id="product-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div className="k-field">
          <label htmlFor="product-stock">Estoque</label>
          <input id="product-stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
        <label className="k-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Produto ativo
        </label>
        <label className="k-check">
          <input type="checkbox" checked={trackInventory} onChange={(e) => setTrackInventory(e.target.checked)} />
          Controlar estoque
        </label>
      </div>
      <div className="k-actions">
        {status ? <span className="k-status">{status}</span> : null}
        <button className="k-button k-button--primary" type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar produto"}
        </button>
      </div>
    </form>
  );
}
