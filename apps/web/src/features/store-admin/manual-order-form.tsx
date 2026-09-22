import { useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Product } from "@white-label/catalog";
import { createMerchantManualOrder } from "../../lib/server/operations-orders.functions.ts";
import { listMerchantProducts } from "../../lib/server/catalog.functions.ts";
import { formatMoney } from "./format.ts";

interface SaleOption {
  key: string;
  productId: string;
  variantId: string | null;
  label: string;
  priceCents: number;
}

interface SaleItem { key: string; quantity: string; }

function optionsFromProducts(products: readonly Product[]): SaleOption[] {
  const options: SaleOption[] = [];
  for (const product of products) {
    if (!product.variants.length) {
      options.push({ key: `${product.id}:base`, productId: product.id, variantId: null, label: product.name, priceCents: product.priceCents });
      continue;
    }
    for (const variant of product.variants) {
      if (variant.active) options.push({ key: `${product.id}:${variant.id}`, productId: product.id, variantId: variant.id, label: `${product.name} · ${variant.name}`, priceCents: variant.priceCents });
    }
  }
  return options;
}

// eslint-disable-next-line max-lines-per-function -- estado, busca e submissão pertencem ao mesmo formulário transacional.
export function ManualOrderForm({ products }: Readonly<{ products: Product[] }>): React.JSX.Element {
  const router = useRouter();
  const [catalogProducts, setCatalogProducts] = useState(products);
  const [productSearch, setProductSearch] = useState("");
  const options = useMemo(() => optionsFromProducts(catalogProducts.filter((product) => product.active)), [catalogProducts]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<SaleItem[]>([{ key: options[0]?.key ?? "", quantity: "1" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = items.reduce((sum, item) => {
    const option = options.find((candidate) => candidate.key === item.key);
    const quantity = Number.parseInt(item.quantity, 10);
    return sum + (option && Number.isInteger(quantity) ? option.priceCents * quantity : 0);
  }, 0);

  function updateItem(index: number, patch: Partial<SaleItem>): void {
    setItems((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item));
  }

  async function searchProducts(): Promise<void> {
    setBusy(true); setError("");
    try {
      const page = await listMerchantProducts({ data: { page: 1, pageSize: 100, search: productSearch.trim() || undefined, sort: "name" } });
      setCatalogProducts((current) => {
        const merged = new Map(current.map((product) => [product.id, product]));
        for (const product of page.items) merged.set(product.id, product);
        return [...merged.values()];
      });
      if (!page.items.length) setError("Nenhum produto encontrado para essa busca.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível buscar produtos.");
    } finally { setBusy(false); }
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const payload = items.map((item) => {
        const option = options.find((candidate) => candidate.key === item.key);
        const quantity = Number.parseInt(item.quantity, 10);
        if (!option || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error("Revise os itens da venda");
        return { productId: option.productId, variantId: option.variantId, quantity };
      });
      if (new Set(payload.map((item) => `${item.productId}:${item.variantId ?? "base"}`)).size !== payload.length) {
        throw new Error("O mesmo produto ou variante foi adicionado mais de uma vez");
      }
      const order = await createMerchantManualOrder({ data: {
        idempotencyKey: crypto.randomUUID(),
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        notes: notes.trim() || null,
        items: payload,
      } });
      await router.navigate({ to: "/admin/orders/$id", params: { id: order.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar a venda.");
    } finally { setBusy(false); }
  }

  return <details className="k-composer">
    <summary><span><strong>Nova venda manual</strong><small>Registre um pedido com preços validados no servidor.</small></span><span className="k-composer__action">Criar</span></summary>
    <form className="k-composer__body k-form" onSubmit={(event) => { void submit(event); }}>
      <div className="k-toolbar"><label className="k-toolbar__search"><span className="k-visually-hidden">Buscar produto para a venda</span><input value={productSearch} onChange={(event) => { setProductSearch(event.target.value); }} placeholder="Buscar produto, SKU ou categoria…" /></label><button className="k-button" type="button" disabled={busy} onClick={() => { void searchProducts(); }}>Buscar produto</button></div>
      <div className="k-form__grid">
        <label className="k-field"><span>Cliente</span><input maxLength={160} value={customerName} onChange={(event) => { setCustomerName(event.target.value); }} placeholder="Nome opcional" /></label>
        <label className="k-field"><span>Telefone</span><input maxLength={30} value={customerPhone} onChange={(event) => { setCustomerPhone(event.target.value); }} placeholder="Telefone opcional" /></label>
      </div>
      <div className="k-stack">{items.map((item, index) => <div className="k-row" key={`${String(index)}:${item.key}`}>
        <label className="k-field" style={{ flex: 1 }}><span>Produto / variante</span><select required value={item.key} onChange={(event) => { updateItem(index, { key: event.target.value }); }}><option value="">Selecione</option>{options.map((option) => <option key={option.key} value={option.key}>{option.label} · {formatMoney(option.priceCents)}</option>)}</select></label>
        <label className="k-field"><span>Quantidade</span><input required type="number" min={1} max={999} value={item.quantity} onChange={(event) => { updateItem(index, { quantity: event.target.value }); }} /></label>
        {items.length > 1 ? <button className="k-button" type="button" disabled={busy} onClick={() => { setItems((current) => current.filter((_, currentIndex) => currentIndex !== index)); }}>Remover</button> : null}
      </div>)}</div>
      <button className="k-button" type="button" disabled={busy || !options.length} onClick={() => { setItems((current) => [...current, { key: options[0]?.key ?? "", quantity: "1" }]); }}>Adicionar item</button>
      <label className="k-field"><span>Observação</span><textarea maxLength={1000} value={notes} onChange={(event) => { setNotes(event.target.value); }} /></label>
      {error ? <div className="k-inline-state k-inline-state--error"><span>{error}</span></div> : null}
      <div className="k-row"><strong>Total calculado: {formatMoney(total)}</strong><button className="k-button k-button--primary" type="submit" disabled={busy || !options.length}>{busy ? "Registrando…" : "Criar venda"}</button></div>
      <small className="k-muted">O total exibido será recalculado no servidor. A confirmação do pedido continua respeitando o estoque real.</small>
    </form>
  </details>;
}
