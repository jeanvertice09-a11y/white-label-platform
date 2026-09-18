import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { adjustMerchantInventory } from "../../lib/server/operations-inventory.functions.ts";

export function InventoryAdjustment(props: Readonly<{
  productId: string;
  variantId: string | null;
}>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const delta = Number(form.get("delta"));
    const reason = String(form.get("reason") ?? "");
    setBusy(true);
    setMessage("");
    try {
      await adjustMerchantInventory({ data: {
        productId: props.productId,
        variantId: props.variantId,
        delta,
        type: "adjustment",
        reason,
      } });
      event.currentTarget.reset();
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível ajustar o estoque.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="k-row" onSubmit={(event) => { void submit(event); }}>
      <input aria-label="Variação de estoque" name="delta" type="number" required placeholder="+5 ou -2" style={{ maxWidth: 110 }} />
      <input aria-label="Motivo do ajuste" name="reason" required maxLength={240} placeholder="Motivo do ajuste" />
      <button className="k-button" disabled={busy} type="submit">Ajustar</button>
      {message ? <span className="k-status k-danger">{message}</span> : null}
    </form>
  );
}
