import { processPaymentWebhook } from "../payment-runtime.ts";
import type { Job } from "./types.ts";

interface WebhookPayload {
  eventId: string;
}

export async function handleWebhookJob(job: Job<WebhookPayload>): Promise<void> {
  if (!job.payload.eventId) throw new Error("Webhook job sem eventId.");
  await processPaymentWebhook(job.payload.eventId);
}
