import { createFileRoute } from "@tanstack/react-router";
import { handleMercadoPagoStoreWebhook } from "../lib/server/payment-webhook.server.ts";
export const Route = createFileRoute("/api/webhooks/mercadopago")({
  server: { handlers: { POST: ({ request }) => handleMercadoPagoStoreWebhook(request) } },
});
