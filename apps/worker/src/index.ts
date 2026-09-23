import { pollPaymentWebhooks } from "./payment-runtime.ts";
import { operationalTick } from "./jobs/runtime.ts";

async function tick(): Promise<void> {
  const results = await Promise.allSettled([pollPaymentWebhooks(), operationalTick()]);
  for (const result of results) {
    if (result.status === "rejected") {
      const error: unknown = result.reason;
      console.error(JSON.stringify({
        level: "error",
        message: "worker.tick.failed",
        name: error instanceof Error ? error.name : "UnknownError",
        error: error instanceof Error ? error.message : "unknown error",
      }));
    }
  }
}

if (import.meta.main) {
  const interval = Math.max(1000, Number(process.env["WORKER_POLL_MS"] ?? 5000));
  if (!process.env["SUPABASE_DB_URL"]) {
    console.warn(JSON.stringify({level:"warn",message:"worker.disabled",reason:"SUPABASE_DB_URL missing"}));
  } else {
    console.warn(JSON.stringify({level:"info",message:"worker.online",pollMs:interval}));
    void tick();
    setInterval(() => void tick(), interval);
  }
}

export { tick };
