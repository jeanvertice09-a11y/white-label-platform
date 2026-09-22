import { pollPaymentWebhooks } from "./payment-runtime.ts";
import { operationalTick } from "./jobs/runtime.ts";

async function tick(): Promise<void> {
  const results = await Promise.allSettled([pollPaymentWebhooks(), operationalTick()]);
  for (const result of results) {
    if (result.status === "rejected") {
      const error: unknown = result.reason;
      console.error("[worker] tick failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }
}

if (import.meta.main) {
  const interval = Math.max(1000, Number(process.env["WORKER_POLL_MS"] ?? 5000));
  if (!process.env["SUPABASE_DB_URL"]) {
    console.warn("[worker] SUPABASE_DB_URL ausente; worker desabilitado.");
  } else {
    console.warn(`[worker] durable queues online (${String(interval)}ms).`);
    void tick();
    setInterval(() => void tick(), interval);
  }
}

export { tick };
