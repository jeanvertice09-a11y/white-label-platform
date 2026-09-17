import type { Job } from "./types.ts";

// Pipeline: HTTP webhook -> autentica provider -> persiste evento ->
// idempotência -> responde rápido -> enqueue -> worker processa -> retry -> DLQ.
export async function handleWebhookJob(job: Job): Promise<void> {
  await Promise.resolve(job);
  if (job.attempts > job.maxAttempts) {
    await sendToDlq(job);
  }
  // Fundação: processamento real de gateway entra aqui (reconciliação via API
  // do provider, nunca confiando só no payload). Marcado como pendente.
}

async function sendToDlq(job: Job): Promise<void> {
  await Promise.resolve(job);
}
