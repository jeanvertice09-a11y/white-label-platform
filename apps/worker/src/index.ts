import { pollPaymentWebhooks } from "./payment-runtime.ts";
import { handleWebhookJob } from "./jobs/webhook.ts";
import {
  handleBillingJob,
  handleDomainVerifyJob,
  handleEmailJob,
  handleMediaJob,
} from "./jobs/handlers.ts";
import type { Job } from "./jobs/types.ts";

async function dispatch(job: Job): Promise<void> {
  switch (job.kind) {
    case "webhook.process":
      await handleWebhookJob(job as Job<{ eventId: string }>);
      break;
    case "email.send":
      await handleEmailJob(job as Job<{ to: string; subject: string }>);
      break;
    case "media.process":
      await handleMediaJob(job as Job<{ objectKey: string }>);
      break;
    case "billing.reconcile":
      await handleBillingJob(job as Job<{ level: string }>);
      break;
    case "domain.verify":
      await handleDomainVerifyJob(job as Job<{ hostname: string }>);
      break;
  }
}

async function paymentTick(): Promise<void> {
  try {
    await pollPaymentWebhooks();
  } catch {
    console.error("[worker] payment webhook poll failed.");
  }
}

if (import.meta.main) {
  const tick = Math.max(250, Number(process.env["WORKER_POLL_MS"] ?? 1000));
  if (!process.env["SUPABASE_DB_URL"]) {
    console.warn("[worker] SUPABASE_DB_URL ausente; payment poll desabilitado.");
  } else {
    console.warn(`[worker] payment poll online (${String(tick)}ms).`);
    void paymentTick();
    setInterval(() => void paymentTick(), tick);
  }
}

export { dispatch };
