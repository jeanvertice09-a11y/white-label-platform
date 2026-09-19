import { useState } from "react";
import { moveMerchantInventory } from "../../lib/server/operations-inventory.functions.ts";

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function InventoryAdjustment(props: Readonly<{
  productId: string;
  variantId: string | null;
  onCompleted: () => Promise<void>;
}>): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const kind = field(form, "kind") as "entry" | "exit" | "set";
    setBusy(true);
    setMessage("");
    try {
      const result = await moveMerchantInventory({ data: {
        operationId: crypto.randomUUID(),
        productId: props.productId,
        variantId: props.variantId,
        kind,
        quantity: Number(field(form, "quantity")),
        reason: field(form, "reason"),
      } });
      setMessage(result.applied ? `Saldo atualizado: ${String(result.currentQuantity)}` : `Saldo já processado: ${String(result.currentQuantity)}`);
      event.currentTarget.reset();
      await props.onCompleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível movimentar o estoque.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="k-inline-editor">
      <summary>Movimentar</summary>
      <form className="k-inline-editor__body" onSubmit={(event) => { void submit(event); }}>
        <select aria-label="Operação de estoque" name="kind" defaultValue="entry" disabled={busy}>
          <option value="entry">Entrada</option>
          <option value="exit">Saída</option>
          <option value="set">Definir saldo</option>
        </select>
        <input aria-label="Quantidade" name="quantity" type="number" min={0} max={1_000_000} step={1} required placeholder="Quantidade" disabled={busy} />
        <input aria-label="Motivo da movimentação" name="reason" required maxLength={240} placeholder="Motivo" disabled={busy} />
        <button className="k-button k-button--primary" disabled={busy} type="submit">{busy ? "Salvando…" : "Aplicar"}</button>
        {message ? <span className="k-inline-editor__message" role="status">{message}</span> : null}
      </form>
    </details>
  );
}
