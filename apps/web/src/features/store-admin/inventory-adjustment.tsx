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
      setMessage(result.applied ? `Saldo atualizado: ${result.currentQuantity}` : `Saldo já processado: ${result.currentQuantity}`);
      event.currentTarget.reset();
      await props.onCompleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível movimentar o estoque.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="k-form" onSubmit={(event) => { void submit(event); }}>
      <div className="k-row">
        <select aria-label="Operação de estoque" name="kind" defaultValue="entry" disabled={busy}>
          <option value="entry">Entrada</option>
          <option value="exit">Saída</option>
          <option value="set">Ajustar saldo para</option>
        </select>
        <input aria-label="Quantidade" name="quantity" type="number" min={0} max={1_000_000} step={1} required placeholder="Quantidade" disabled={busy} style={{ maxWidth: 130 }} />
        <input aria-label="Motivo da movimentação" name="reason" required maxLength={240} placeholder="Motivo" disabled={busy} />
        <button className="k-button" disabled={busy} type="submit">{busy ? "Salvando…" : "Aplicar"}</button>
      </div>
      {message ? <div className="k-status">{message}</div> : null}
    </form>
  );
}
