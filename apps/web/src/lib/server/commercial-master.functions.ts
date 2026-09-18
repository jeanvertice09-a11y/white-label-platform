import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createRealDeps, loadMaster } from "./route-context.server.ts";

export interface MasterCommercialSummary {
  commercialPlans: number;
  activeCommercialPlans: number;
  storeSubscriptions: number;
  activeStoreSubscriptions: number;
  validTrials: number;
  expiredTrialsStillMarkedTrialing: number;
  suspendedSubscriptions: number;
}

export const getMasterCommercialSummary = createServerFn({ method: "GET" }).handler(async () => {
  const deps = await createRealDeps();
  await loadMaster({ host: getRequestHost() }, deps);
  const rows = await createAdminSqlExecutor().query(
    `select
       (select count(*) from public.tenant_plans)::integer as commercial_plans,
       (select count(*) from public.tenant_plans where active=true)::integer as active_commercial_plans,
       (select count(*) from public.store_subscriptions)::integer as store_subscriptions,
       (select count(*) from public.store_subscriptions where status='active')::integer as active_store_subscriptions,
       (select count(*) from public.store_subscriptions
         where status='trialing' and trial_ends_at>now())::integer as valid_trials,
       (select count(*) from public.store_subscriptions
         where status='trialing' and (trial_ends_at is null or trial_ends_at<=now()))::integer as expired_trials,
       (select count(*) from public.store_subscriptions where status='suspended')::integer as suspended_subscriptions`,
    [],
  );
  const row = rows[0];
  if (!row) throw new Error("Resumo comercial indisponível");
  return {
    commercialPlans: Number(row["commercial_plans"]),
    activeCommercialPlans: Number(row["active_commercial_plans"]),
    storeSubscriptions: Number(row["store_subscriptions"]),
    activeStoreSubscriptions: Number(row["active_store_subscriptions"]),
    validTrials: Number(row["valid_trials"]),
    expiredTrialsStillMarkedTrialing: Number(row["expired_trials"]),
    suspendedSubscriptions: Number(row["suspended_subscriptions"]),
  } satisfies MasterCommercialSummary;
});
