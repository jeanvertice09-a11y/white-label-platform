import { useState } from "react";
import { moveMerchantInventory } from "../../lib/server/operations-inventory.functions.ts";
import "../../styles/inventory-feedback.css";

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

type Feedback = { kind: "success" | "error"; message: string } | null;

export function InventoryAdjustment(props: Readonly<{
  productId: string;
  variantId: string | null;
  onCompleted: () => Promise<void>;
}>): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    const target = event.currentTarget;
    const form = new FormData(target);
    const kind = field(form, "kind") as "entry" | "exit" | "set";
    setBusy(true);
    setFeedback(null);
    try {
      const result = await moveMerchantInventory({ data: {
        operationId: crypto.randomUUID(), productId: props.productId, variantId: props.variantId,
        kind, quantity: Number(field(form, "quantity")), reason: field(form, "reason"),
      } });
      await props.onCompleted();
      target.reset();
      setFeedback({ kind: "success", message: result.applied ? `Saldo atualizado e lista recarregada: ${String(result.currentQuantity)}` : `Movimentação já processada; lista recarregada com saldo ${String(result.currentQuantity)}` });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Não foi possível movimentar ou atualizar o estoque." });
    } finally { setBusy(false); }
  }

  return (
    <details className="k-inline-editor">
      <summary>Movimentar</summary>
      <form className="k-inline-editor__body" onSubmit={(event) => { void submit(event); }}>
        <select aria-label="Operação de estoque" name="kind" defaultValue="entry" disabled={busy}><option value="entry">Entrada</option><option value="exit">Saída</option><option value="set">Definir saldo</option></select>
        <input aria-label="Quantidade" name="quantity" type="number" min={0} max={1_000_000} step={1} required placeholder="Quantidade" disabled={busy} />
        <input aria-label="Motivo da movimentação" name="reason" required maxLength={240} placeholder="Motivo" disabled={busy} />
        <button className="k-button k-button--primary" disabled={busy} type="submit">{busy ? "Salvando e atualizando…" : "Aplicar"}</button>
        {feedback ? <span className={feedback.kind === "error" ? "k-inline-editor__message k-inline-editor__message--error" : "k-inline-editor__message"} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</span> : null}
      </form>
    </details>
  );
}
