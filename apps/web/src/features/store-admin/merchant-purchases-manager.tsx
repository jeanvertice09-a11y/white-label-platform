import { useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import type { InventoryPage } from "@white-label/inventory";
import type { Page, Purchase, Supplier } from "../../../../../packages/merchant-ops/src/types.ts";
import { listMerchantInventory } from "../../lib/server/operations-inventory.functions.ts";
import {
  cancelMerchantPurchase,
  createMerchantPurchase,
  listMerchantPurchases,
  receiveMerchantPurchase,
} from "../../lib/server/operations-merchant.functions.ts";
import { formatCurrency, formatDate, messageFrom, parseMoneyToCents, today } from "./merchant-operations-utils.ts";

type DraftItem = { key: string; productId: string; variantId: string | null; label: string; quantity: number; unitCost: string };
const PAGE_SIZE = 25;

export function MerchantPurchasesManager(props: Readonly<{
  initial: Page<Purchase>;
  suppliers: Supplier[];
  inventory: InventoryPage;
}>): React.JSX.Element {
  const [data, setData] = useState(props.initial);
  const [inventory, setInventory] = useState(props.inventory);
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(today());
  const [discount, setDiscount] = useState("0,00");
  const [surcharge, setSurcharge] = useState("0,00");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const options = inventory.items.filter((item) => item.trackInventory);
  const subtotal = useMemo(() => items.reduce((sum, item) => {
    try { return sum + item.quantity * parseMoneyToCents(item.unitCost); } catch { return sum; }
  }, 0), [items]);
  let total = subtotal;
  try { total = subtotal - parseMoneyToCents(discount) + parseMoneyToCents(surcharge); } catch { /* validated on submit */ }

  async function refreshPurchases(page = 1): Promise<void> {
    setData(await listMerchantPurchases({ data: { page, pageSize: PAGE_SIZE } }));
  }

  async function searchInventory(): Promise<void> {
    setLoading(true); setError("");
    try {
      setInventory(await listMerchantInventory({ data: { page: 1, pageSize: 100, search: inventorySearch.trim() || undefined } }));
      setSelectedKey("");
    } catch (cause) { setError(messageFrom(cause, "Não foi possível buscar produtos.")); }
    finally { setLoading(false); }
  }

  function addItem(): void {
    const selected = options.find((item) => `${item.productId}:${item.variantId ?? ""}` === selectedKey);
    if (!selected || items.some((item) => item.key === selectedKey)) return;
    setItems([...items, {
      key: selectedKey,
      productId: selected.productId,
      variantId: selected.variantId,
      label: `${selected.productName}${selected.variantName ? ` · ${selected.variantName}` : ""}${selected.sku ? ` · ${selected.sku}` : ""}`,
      quantity: 1,
      unitCost: "0,00",
    }]);
    setSelectedKey("");
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setLoading(true); setError(""); setSuccess("");
    try {
      if (!items.length) throw new Error("Adicione pelo menos um item à compra.");
      await createMerchantPurchase({ data: {
        supplierId: supplierId || null,
        purchasedAt,
        discountCents: parseMoneyToCents(discount),
        surchargeCents: parseMoneyToCents(surcharge),
        notes: notes.trim() || null,
        items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, unitCostCents: parseMoneyToCents(item.unitCost) })),
      } });
      setItems([]); setSupplierId(""); setDiscount("0,00"); setSurcharge("0,00"); setNotes(""); setPurchasedAt(today());
      setSuccess("Compra salva como rascunho. Receba-a quando a mercadoria entrar no estoque.");
      await refreshPurchases(1);
    } catch (cause) { setError(messageFrom(cause, "Não foi possível salvar a compra.")); }
    finally { setLoading(false); }
  }

  async function changeStatus(purchase: Purchase, action: "receive" | "cancel"): Promise<void> {
    setLoading(true); setError(""); setSuccess("");
    try {
      if (action === "receive") {
        await receiveMerchantPurchase({ data: { purchaseId: purchase.id } });
        setSuccess("Compra recebida e estoque movimentado uma única vez.");
      } else {
        await cancelMerchantPurchase({ data: { purchaseId: purchase.id } });
        setSuccess("Compra cancelada.");
      }
      await Promise.all([refreshPurchases(data.page), searchInventory()]);
    } catch (cause) { setError(messageFrom(cause, "Não foi possível alterar a compra.")); }
    finally { setLoading(false); }
  }

  return <div className="k-stack">
    <section className="k-card">
      <h2>Nova compra de estoque</h2>
      <p className="k-muted">O total é recalculado no servidor e a entrada no estoque só ocorre ao receber a compra.</p>
      <form className="k-form" onSubmit={(event) => { void submit(event); }}>
        <div className="k-form__grid">
          <label className="k-field"><span>Fornecedor</span><select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); }}><option value="">Sem fornecedor</option>{props.suppliers.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="k-field"><span>Data da compra</span><input type="date" required value={purchasedAt} onChange={(e) => { setPurchasedAt(e.target.value); }} /></label>
        </div>
        <div className="k-toolbar">
          <label className="k-toolbar__search"><span className="k-visually-hidden">Buscar produto</span><input value={inventorySearch} onChange={(e) => { setInventorySearch(e.target.value); }} placeholder="Buscar produto, variante ou SKU…" /></label>
          <button className="k-button" type="button" onClick={() => { void searchInventory(); }} disabled={loading}>Buscar produto</button>
        </div>
        <div className="k-form__grid">
          <label className="k-field k-field--full"><span>Produto / variante</span><select value={selectedKey} onChange={(e) => { setSelectedKey(e.target.value); }}><option value="">Selecione…</option>{options.map((item) => { const key = `${item.productId}:${item.variantId ?? ""}`; return <option key={key} value={key}>{item.productName}{item.variantName ? ` · ${item.variantName}` : ""}{item.sku ? ` · ${item.sku}` : ""} · saldo {item.currentQuantity}</option>; })}</select></label>
        </div>
        <div className="k-actions"><button className="k-button" type="button" disabled={!selectedKey || loading} onClick={addItem}>Adicionar item</button></div>
        {items.length ? <div className="k-table-wrap"><table className="k-table"><thead><tr><th>Item</th><th>Quantidade</th><th>Custo unitário</th><th>Subtotal</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.key}><td><strong>{item.label}</strong></td><td><input aria-label="Quantidade" type="number" min={1} max={1000000} value={item.quantity} onChange={(e) => { const quantity = Math.max(1, Number(e.target.value) || 1); setItems(items.map((current) => current.key === item.key ? { ...current, quantity } : current)); }} /></td><td><input aria-label="Custo unitário" inputMode="decimal" value={item.unitCost} onChange={(e) => { setItems(items.map((current) => current.key === item.key ? { ...current, unitCost: e.target.value } : current)); }} /></td><td>{formatCurrency(item.quantity * parseMoneyToCents(item.unitCost))}</td><td><button className="k-button" type="button" onClick={() => { setItems(items.filter((current) => current.key !== item.key)); }}>Remover</button></td></tr>)}</tbody></table></div> : null}
        <div className="k-form__grid">
          <label className="k-field"><span>Desconto</span><input inputMode="decimal" value={discount} onChange={(e) => { setDiscount(e.target.value); }} /></label>
          <label className="k-field"><span>Acréscimo</span><input inputMode="decimal" value={surcharge} onChange={(e) => { setSurcharge(e.target.value); }} /></label>
          <label className="k-field k-field--full"><span>Observação</span><textarea maxLength={4000} value={notes} onChange={(e) => { setNotes(e.target.value); }} /></label>
        </div>
        <div className="k-row"><strong>Total previsto: {formatCurrency(Math.max(0, total))}</strong><button className="k-button k-button--primary" type="submit" disabled={loading || !items.length}>Salvar compra</button></div>
      </form>
    </section>

    <section className="k-workspace-section">
      <div className="k-section-head"><div><h2>Compras</h2><p>Rascunhos, recebimentos e cancelamentos com histórico de itens.</p></div></div>
      {error ? <div className="k-inline-state k-inline-state--error"><strong>Erro</strong><span>{error}</span></div> : null}
      {success ? <div className="k-inline-state"><strong>Concluído</strong><span>{success}</span></div> : null}
      {!data.items.length ? <div className="k-empty"><strong>Nenhuma compra</strong><span>Crie uma compra acima para começar.</span></div> : <div className="k-table-wrap k-table-wrap--flush"><table className="k-table"><thead><tr><th>Data</th><th>Fornecedor / itens</th><th>Status</th><th>Total</th><th>Ações</th></tr></thead><tbody>{data.items.map((purchase) => <tr key={purchase.id}><td>{formatDate(purchase.purchasedAt)}</td><td><strong>{purchase.supplierName ?? "Sem fornecedor"}</strong><div className="k-row__meta">{purchase.items.length} item(ns) · {purchase.items.map((item) => item.variantName ?? item.productName).join(", ")}</div></td><td><span className={purchase.status === "received" ? "k-badge k-badge--on" : "k-badge"}>{purchase.status === "draft" ? "Rascunho" : purchase.status === "received" ? "Recebida" : "Cancelada"}</span></td><td>{formatCurrency(purchase.totalCents)}</td><td>{purchase.status === "draft" ? <div className="k-row"><button className="k-button k-button--primary" type="button" disabled={loading} onClick={() => { void changeStatus(purchase, "receive"); }}>Receber</button><button className="k-button" type="button" disabled={loading} onClick={() => { void changeStatus(purchase, "cancel"); }}>Cancelar</button></div> : "—"}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
