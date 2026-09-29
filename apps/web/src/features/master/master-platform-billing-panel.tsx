import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { MasterEmptyState, MasterPanel } from "../../components/master/ui.tsx";
import { masterDate, masterMoney } from "../../components/master/format.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";
import { statusLabel } from "../../lib/ui-labels.ts";
import type { MasterWhiteLabelDetail } from "../../lib/server/master-white-label.types.ts";
import type { PlatformBillingSnapshot, PlatformPlanView } from "../../lib/server/platform-billing.types.ts";
import {
  cancelMasterPlatformSubscription,
  createMasterPlatformCharge,
  createMasterPlatformSubscription,
  expireMasterPlatformSubscription,
} from "../../lib/server/platform-billing.functions.ts";

interface ActionProps {
  billing: PlatformBillingSnapshot;
  busy: boolean;
  run: (action: () => Promise<unknown>, success: string) => Promise<void>;
}

function intervalLabel(value: string | null): string {
  if (value === "monthly") return "Mensal";
  if (value === "quarterly") return "Trimestral";
  if (value === "yearly") return "Anual";
  return value ?? "Não configurado";
}

export function MasterPlatformBillingPanel({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<unknown>, success: string): Promise<void> {
    setBusy(true); setMessage("");
    try { await action(); setMessage(success); await router.invalidate(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação de faturamento."); }
    finally { setBusy(false); }
  }
  const billing = detail.platformBilling;
  return (
    <MasterPanel title="Assinatura Kataluu">
      {billing?.subscriptionId
        ? <BillingCurrent billing={billing} busy={busy} run={run} />
        : <SubscriptionCreator detail={detail} busy={busy} run={run} />}
      <p>{detail.platformPlans.length} plano(s) Kataluu disponível(is). Preço e meio de pagamento são sempre validados no servidor.</p>
      {message ? <div className="k-status" role="status">{message}</div> : null}
    </MasterPanel>
  );
}

function SubscriptionCreator({ detail, busy, run }: Readonly<{
  detail: MasterWhiteLabelDetail;
  busy: boolean;
  run: ActionProps["run"];
}>): React.JSX.Element {
  const plans = detail.platformPlans.filter((plan) => plan.active && plan.billingInterval !== null);
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const planId = new FormData(event.currentTarget).get("planId");
    if (typeof planId !== "string" || !planId) return;
    await run(
      () => createMasterPlatformSubscription({ data: { tenantId: detail.tenant.id, planId } }),
      "Assinatura Kataluu criada.",
    );
  }
  return <><MasterEmptyState title="Sem assinatura Kataluu" description="Nenhuma assinatura Kataluu está vinculada a esta White Label." />{plans.length ? <form onSubmit={(event) => { void submit(event); }}><div className="k-field"><label htmlFor={`platform-plan-${detail.tenant.id}`}>Plano Kataluu</label><select id={`platform-plan-${detail.tenant.id}`} name="planId" required>{plans.map((plan) => <PlanOption key={plan.id} plan={plan}/>)}</select></div><div className="k-actions"><button className="k-button k-button--primary" disabled={busy}>Criar assinatura</button></div></form> : <p>Nenhum plano Kataluu ativo com periodicidade de cobrança configurada.</p>}</>;
}

function PlanOption({ plan }: Readonly<{ plan: PlatformPlanView }>): React.JSX.Element {
  return <option value={plan.id}>{plan.name} · {masterMoney(plan.priceCents)} · {intervalLabel(plan.billingInterval)}</option>;
}

function BillingCurrent({ billing, busy, run }: Readonly<ActionProps>): React.JSX.Element {
  return <><BillingTable billing={billing}/><BillingActions billing={billing} busy={busy} run={run}/></>;
}

function BillingTable({ billing }: Readonly<{ billing: PlatformBillingSnapshot }>): React.JSX.Element {
  return <div className="master-table-wrap"><table className="master-table"><tbody>
    <Row label="Plano" value={billing.planName ?? "—"}/>
    <Row label="Status da assinatura" value={statusLabel(billing.subscriptionStatus)}/>
    <Row label="Preço" value={billing.priceCents === null ? "—" : masterMoney(billing.priceCents)}/>
    <Row label="Periodicidade" value={intervalLabel(billing.billingInterval)}/>
    <Row label="Período de teste até" value={dateValue(billing.trialEndsAt)}/>
    <Row label="Período atual até" value={dateValue(billing.currentPeriodEndsAt)}/>
    <Row label="Provedor de pagamento" value={billing.provider ?? "—"}/>
    <Row label="Status do pagamento" value={statusLabel(billing.paymentStatus)}/>
    <Row label="Valor do pagamento" value={billing.paymentAmountCents === null ? "—" : masterMoney(billing.paymentAmountCents)}/>
    <Row label="Pagamento criado" value={dateValue(billing.paymentCreatedAt)}/>
  </tbody></table></div>;
}

function BillingActions({ billing, busy, run }: Readonly<ActionProps>): React.JSX.Element {
  const id = billing.subscriptionId;
  if (!id) return <></>;
  const closed = billing.subscriptionStatus === "canceled" || billing.subscriptionStatus === "expired";
  return <div className="k-actions"><button className="k-button k-button--primary" disabled={busy || closed} onClick={() => { void run(() => createMasterPlatformCharge({ data: { subscriptionId: id } }), "Cobrança de teste criada ou reutilizada."); }}>Gerar cobrança de teste</button><button className="k-button" disabled={busy || closed} onClick={() => { if (confirmDangerousAction("Cancelar esta assinatura Kataluu? A White Label deixará de ter uma assinatura ativa após o processamento do cancelamento.")) void run(() => cancelMasterPlatformSubscription({ data: { subscriptionId: id } }), "Assinatura cancelada."); }}>Cancelar assinatura</button>{billing.subscriptionStatus === "canceled" ? <button className="k-button" disabled={busy} onClick={() => { if (confirmDangerousAction("Processar o encerramento desta assinatura cancelada? Esta ação conclui o ciclo de expiração no sistema.")) void run(() => expireMasterPlatformSubscription({ data: { subscriptionId: id } }), "Encerramento processado."); }}>Processar encerramento</button> : null}</div>;
}

function Row({ label, value }: Readonly<{ label: string; value: string }>): React.JSX.Element {
  return <tr><th>{label}</th><td>{value}</td></tr>;
}
function dateValue(value: string | null): string { return value ? masterDate(value) : "—"; }
