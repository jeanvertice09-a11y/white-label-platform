import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { OrderStatus } from "@white-label/orders";
import {
  advanceMerchantOrder,
  cancelMerchantOrder,
  confirmMerchantOrder,
  refundMerchantOrderPayment,
} from "../../lib/server/operations-orders.functions.ts";

function nextStatus(status: OrderStatus): "preparing" | "ready" | "completed" | null {
  if (status === "confirmed") return "preparing";
  if (status === "preparing") return "ready";
  if (status === "ready") return "completed";
  return null;
}

export function OrderActions(props: Readonly<{
  orderId: string;
  status: OrderStatus;
  paymentStatus?: string | null;
}>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const next = nextStatus(props.status);

  async function run(action: "confirm" | "cancel" | "advance" | "refund"): Promise<void> {
    setBusy(true);
    setMessage("");
    try {
      if (action === "confirm") {
        await confirmMerchantOrder({ data: { id: props.orderId } });
      } else if (action === "cancel") {
        await cancelMerchantOrder({ data: { id: props.orderId } });
      } else if (action === "refund") {
        if (!window.confirm("Reembolsar este pagamento no Mercado Pago? Esta ação financeira não pode ser desfeita.")) return;
        await refundMerchantOrderPayment({ data: { id: props.orderId } });
        setMessage("Reembolso solicitado ao Mercado Pago. O status será atualizado automaticamente.");
      } else if (next) {
        await advanceMerchantOrder({ data: { id: props.orderId, status: next } });
      }
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="k-actions">
      {message ? <span className="k-status k-danger">{message}</span> : null}
      {props.status === "pending" ? (
        <button className="k-button k-button--primary" disabled={busy} type="button" onClick={() => { void run("confirm"); }}>
          Confirmar pedido
        </button>
      ) : null}
      {next ? (
        <button className="k-button k-button--primary" disabled={busy} type="button" onClick={() => { void run("advance"); }}>
          {next === "preparing" ? "Iniciar preparo" : next === "ready" ? "Marcar pronto" : "Concluir"}
        </button>
      ) : null}
      {props.paymentStatus === "paid" ? (
        <button className="k-button" disabled={busy} type="button" onClick={() => { void run("refund"); }}>
          Reembolsar pagamento
        </button>
      ) : null}
      {["pending", "confirmed", "preparing", "ready"].includes(props.status) ? (
        <button className="k-button" disabled={busy} type="button" onClick={() => { void run("cancel"); }}>
          Cancelar
        </button>
      ) : null}
    </div>
  );
}
