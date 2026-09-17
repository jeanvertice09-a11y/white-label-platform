import { handleWebhookJob } from "./jobs/webhook.ts";
import { handleBillingJob, handleDomainVerifyJob, handleEmailJob, handleMediaJob } from "./jobs/handlers.ts";
import type { Job } from "./jobs/types.ts";

async function dispatch(job: Job): Promise<void> {
  switch (job.kind) {
    case "webhook.process":
      await handleWebhookJob(job);
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

// Infra mínima executável: loop de poll (fila real — ex. Postgres/SQS —
// entra quando houver Supabase local). Web e worker NÃO se misturam.
if (import.meta.main) {
  const tick = Number(process.env["WORKER_POLL_MS"] ?? 1000);
  const tickLabel = String(tick);
  console.warn(`[worker] online (poll ${tickLabel}ms). Aguardando fila externa.`);
  setInterval(() => {
    void Promise.resolve(dispatch);
  }, tick);
}

export { dispatch };
