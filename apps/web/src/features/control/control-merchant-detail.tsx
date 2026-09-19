import { useState } from "react";
import type {
  ControlMerchantDetail,
  ControlMerchantPlanOption,
} from "../../lib/server/control-merchants.types.ts";
import {
  assignControlMerchantPlanAction,
  changeControlMerchantOwnerAction,
  setControlMerchantStatusAction,
  setControlSubscriptionStatusAction,
  updateControlMerchantAction,
} from "../../lib/server/control-merchants.functions.ts";
import {
  createControlTenantCharge,
  reconcileControlTenantPayment,
} from "../../lib/server/tenant-billing.functions.ts";

function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

type DetailProps = Readonly<{
  detail: ControlMerchantDetail;
  plans: ControlMerchantPlanOption[];
  onChanged: () => Promise<void>;
}>;

function StoreEditor({ detail, onChanged }: DetailProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await updateControlMerchantAction({ data: { storeId: detail.merchant.id, name: formText(form, "name"), slug: formText(form, "slug") } });
      setMessage("Dados atualizados.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao editar.");
    }
  }
  return <form className="control-card" onSubmit={(event) => { void submit(event); }}><h3>Dados da loja</h3><div className="k-form__grid"><div className="k-field"><label htmlFor="store-edit-name">Nome</label><input id="store-edit-name" name="name" defaultValue={detail.merchant.name} required /></div><div className="k-field"><label htmlFor="store-edit-slug">Slug</label><input id="store-edit-slug" name="slug" defaultValue={detail.merchant.slug} required /></div></div>{message ? <div className="k-status">{message}</div> : null}<div className="k-actions"><button className="k-button k-button--primary" type="submit">Salvar alterações</button></div></form>;
}

function OwnerEditor({ detail, onChanged }: DetailProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await changeControlMerchantOwnerAction({ data: { storeId: detail.merchant.id, ownerEmail: formText(form, "ownerEmail") } });
      setMessage("Responsável atualizado.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao alterar responsável.");
    }
  }
  return <form className="control-card" onSubmit={(event) => { void submit(event); }}><h3>Responsável</h3><p>{detail.merchant.ownerEmail ?? "Sem responsável"}</p><div className="k-field"><label htmlFor="store-owner-email">Novo e-mail existente</label><input id="store-owner-email" name="ownerEmail" type="email" required /></div>{message ? <div className="k-status">{message}</div> : null}<div className="k-actions"><button className="k-button" type="submit">Trocar responsável</button></div></form>;
}

function PlanEditor({ detail, plans, onChanged }: DetailProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await assignControlMerchantPlanAction({ data: { storeId: detail.merchant.id, planId: formText(form, "planId"), useTrial: form.get("useTrial") === "on" } });
      setMessage("Plano/assinatura atualizado.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao alterar plano.");
    }
  }
  return <form className="control-card" onSubmit={(event) => { void submit(event); }}><h3>Plano comercial</h3><p>Atual: {detail.merchant.planName ?? "Sem plano"}</p><div className="k-form__grid"><div className="k-field"><label htmlFor="store-plan">Plano da White Label</label><select id="store-plan" name="planId" defaultValue={detail.merchant.planId ?? ""} required><option value="" disabled>Selecione</option>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name} · {plan.trialEnabled ? `${String(plan.trialDays)}d trial` : "sem trial"}</option>)}</select></div><label className="k-field"><span>Trial</span><span className="console-checkbox-row"><input name="useTrial" type="checkbox" />Iniciar trial permitido pelo plano</span></label></div>{message ? <div className="k-status">{message}</div> : null}<div className="k-actions"><button className="k-button k-button--primary" type="submit">Aplicar plano</button></div></form>;
}

function StatusActions({ detail, onChanged }: DetailProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  async function change(status: "active" | "suspended"): Promise<void> {
    try {
      await setControlMerchantStatusAction({ data: { storeId: detail.merchant.id, status } });
      setMessage(status === "active" ? "Loja reativada." : "Loja suspensa.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao alterar status.");
    }
  }
  return <div className="control-card"><h3>Status operacional</h3><p>Estado atual: <span className="control-badge">{detail.merchant.status}</span></p><div className="k-actions"><button className="k-button" disabled={detail.merchant.status === "active"} onClick={() => { void change("active"); }} type="button">Ativar</button><button className="k-button" disabled={detail.merchant.status === "suspended"} onClick={() => { void change("suspended"); }} type="button">Suspender</button></div>{message ? <div className="k-status">{message}</div> : null}</div>;
}

function SubscriptionActions({ detail, onChanged }: DetailProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  async function change(status: "active" | "suspended" | "canceled" | "expired"): Promise<void> {
    if (!detail.merchant.subscriptionId) return;
    try {
      await setControlSubscriptionStatusAction({ data: { storeId: detail.merchant.id, subscriptionId: detail.merchant.subscriptionId, status } });
      setMessage("Status da assinatura atualizado.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao alterar assinatura.");
    }
  }
  async function charge(): Promise<void> {
    if (!detail.merchant.subscriptionId) return;
    try {
      const result = await createControlTenantCharge({ data: { storeId: detail.merchant.id, subscriptionId: detail.merchant.subscriptionId } });
      setMessage(result.created ? "Cobrança criada." : "Cobrança idempotente já existente.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao gerar cobrança.");
    }
  }
  return <div className="control-card"><h3>Assinatura e cobrança</h3><div className="console-fact-list"><div className="console-fact-row"><div><strong>Status</strong><small>Assinatura tenant_billing</small></div><span className="control-badge">{detail.merchant.subscriptionStatus ?? "sem assinatura"}</span></div><div className="console-fact-row"><div><strong>Trial</strong><small>Data final configurada</small></div><b>{detail.merchant.trialEndsAt ? new Date(detail.merchant.trialEndsAt).toLocaleDateString("pt-BR") : "—"}</b></div><div className="console-fact-row"><div><strong>Período atual</strong><small>Data final do ciclo</small></div><b>{detail.merchant.currentPeriodEndsAt ? new Date(detail.merchant.currentPeriodEndsAt).toLocaleDateString("pt-BR") : "—"}</b></div></div>{detail.merchant.subscriptionId ? <div className="k-actions"><button className="k-button k-button--primary" type="button" onClick={() => { void charge(); }}>Gerar cobrança</button><button className="k-button" type="button" onClick={() => { void change("active"); }}>Ativar</button><button className="k-button" type="button" onClick={() => { void change("suspended"); }}>Suspender</button><button className="k-button" type="button" onClick={() => { void change("canceled"); }}>Cancelar</button>{detail.merchant.subscriptionStatus === "trialing" ? <button className="k-button" type="button" onClick={() => { void change("expired"); }}>Expirar trial</button> : null}</div> : null}{message ? <div className="k-status">{message}</div> : null}</div>;
}

function RelatedData({ detail, onChanged }: Pick<DetailProps, "detail" | "onChanged">): React.JSX.Element {
  const [message, setMessage] = useState("");
  async function reconcile(paymentId: string): Promise<void> {
    try {
      await reconcileControlTenantPayment({ data: { storeId: detail.merchant.id, paymentId } });
      setMessage("Pagamento reconciliado.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao reconciliar pagamento.");
    }
  }
  return <div className="control-grid control-grid--two"><div className="control-card"><h3>Membros</h3>{detail.members.length ? detail.members.map((member) => <div className="control-row" key={member.userId}><div><strong>{member.email ?? member.userId}</strong><small>{member.role}</small></div></div>) : <div className="control-empty">Nenhum membro.</div>}</div><div className="control-card"><h3>Domínios</h3>{detail.domains.length ? detail.domains.map((domain) => <div className="control-row" key={domain.id}><div><strong>{domain.hostname}</strong><small>{domain.type} · {domain.status}</small></div></div>) : <div className="control-empty">Nenhum domínio da loja.</div>}</div><div className="control-card"><h3>Entitlements e limites</h3>{detail.entitlements.length ? detail.entitlements.map((item) => <div className="control-row" key={item.key}><div><strong>{item.name}</strong><small>{item.kind === "feature" ? (item.enabled ? "habilitado" : "desabilitado") : `limite ${String(item.limitValue ?? 0)}`}</small></div></div>) : <div className="control-empty">Plano sem matriz de entitlements configurada.</div>}</div><div className="control-card"><h3>Pagamentos tenant_billing</h3>{detail.payments.length ? detail.payments.map((payment) => <div className="control-row" key={payment.id}><div><strong>{money(payment.amountCents)}</strong><small>{payment.provider} · {payment.status} · {new Date(payment.createdAt).toLocaleString("pt-BR")}</small></div><button className="k-button" type="button" onClick={() => { void reconcile(payment.id); }}>Reconciliar</button></div>) : <div className="control-empty">Nenhum pagamento.</div>}{message ? <div className="k-status">{message}</div> : null}</div></div>;
}

export function ControlMerchantDetailPanel(props: DetailProps & Readonly<{ onClose: () => void }>): React.JSX.Element {
  const trialLabel = props.detail.merchant.trialEndsAt ? new Date(props.detail.merchant.trialEndsAt).toLocaleDateString("pt-BR") : "Sem trial";
  return (
    <div className="control-section control-merchant-detail">
      <div className="control-page-header">
        <div><span className="console-page-kicker">Detalhe do lojista</span><h1>{props.detail.merchant.name}</h1><p>{props.detail.merchant.slug} · {props.detail.merchant.ownerEmail ?? "sem responsável"}</p></div>
        <button className="k-button" type="button" onClick={props.onClose}>Fechar detalhe</button>
      </div>

      <div className="control-summary-surface" aria-label="Resumo do lojista">
        <div className="control-summary-item"><span>Status da loja</span><strong>{props.detail.merchant.status}</strong><small>Estado operacional</small></div>
        <div className="control-summary-item"><span>Plano</span><strong>{props.detail.merchant.planName ?? "Sem plano"}</strong><small>Oferta atual</small></div>
        <div className="control-summary-item"><span>Assinatura</span><strong>{props.detail.merchant.subscriptionStatus ?? "—"}</strong><small>tenant_billing</small></div>
        <div className="control-summary-item"><span>Trial</span><strong>{trialLabel}</strong><small>Expiração configurada</small></div>
      </div>

      <section className="console-detail-section">
        <div className="console-section-heading"><span>Identidade</span><h2>Loja e responsável</h2><p>Dados operacionais e ownership da loja.</p></div>
        <div className="control-grid control-grid--two"><StoreEditor {...props} /><OwnerEditor {...props} /></div>
      </section>

      <section className="console-detail-section">
        <div className="console-section-heading"><span>Comercial</span><h2>Plano, assinatura e cobrança</h2><p>Configuração comercial e ciclo financeiro do lojista.</p></div>
        <div className="control-grid control-grid--two"><PlanEditor {...props} /><SubscriptionActions {...props} /></div>
      </section>

      <section className="console-detail-section">
        <div className="console-section-heading"><span>Operação</span><h2>Acesso e recursos vinculados</h2><p>Status da loja, membros, domínios, entitlements e pagamentos.</p></div>
        <StatusActions {...props} />
        <RelatedData detail={props.detail} onChanged={props.onChanged} />
      </section>
    </div>
  );
}
