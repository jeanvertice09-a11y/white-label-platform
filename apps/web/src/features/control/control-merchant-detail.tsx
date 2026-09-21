import { useState } from "react";
import type {
  ControlMerchantDetail,
  ControlMerchantPlanOption,
} from "../../lib/server/control-merchants.types.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";
import { domainTypeLabel, roleLabel, statusLabel } from "../../lib/ui-labels.ts";
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
      setMessage(error instanceof Error ? error.message : "Não foi possível editar a loja.");
    }
  }
  return <form className="control-card" onSubmit={(event) => { void submit(event); }}><h3>Dados da loja</h3><div className="k-form__grid"><div className="k-field"><label htmlFor="store-edit-name">Nome</label><input id="store-edit-name" name="name" defaultValue={detail.merchant.name} required /></div><div className="k-field"><label htmlFor="store-edit-slug">Identificador no endereço</label><input id="store-edit-slug" name="slug" defaultValue={detail.merchant.slug} required /><small>Parte técnica usada nos endereços da loja.</small></div></div>{message ? <div className="k-status" role="status">{message}</div> : null}<div className="k-actions"><button className="k-button k-button--primary" type="submit">Salvar alterações</button></div></form>;
}

function OwnerEditor({ detail, onChanged }: DetailProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await changeControlMerchantOwnerAction({ data: { storeId: detail.merchant.id, ownerEmail: formText(form, "ownerEmail") } });
      setMessage("Responsável principal atualizado.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar o responsável principal.");
    }
  }
  return <form className="control-card" onSubmit={(event) => { void submit(event); }}><h3>Responsável principal</h3><p>{detail.merchant.ownerEmail ?? "Sem responsável principal"}</p><div className="k-field"><label htmlFor="store-owner-email">E-mail do novo responsável</label><input id="store-owner-email" name="ownerEmail" type="email" required /><small>O usuário precisa existir e continuar sujeito às validações do servidor.</small></div>{message ? <div className="k-status" role="status">{message}</div> : null}<div className="k-actions"><button className="k-button" type="submit">Trocar responsável</button></div></form>;
}

function PlanEditor({ detail, plans, onChanged }: DetailProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await assignControlMerchantPlanAction({ data: { storeId: detail.merchant.id, planId: formText(form, "planId"), useTrial: form.get("useTrial") === "on" } });
      setMessage("Plano e assinatura atualizados.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar o plano.");
    }
  }
  return <form className="control-card" onSubmit={(event) => { void submit(event); }}><h3>Plano comercial</h3><p>Atual: {detail.merchant.planName ?? "Sem plano"}</p><div className="k-form__grid"><div className="k-field"><label htmlFor="store-plan">Plano da White Label</label><select id="store-plan" name="planId" defaultValue={detail.merchant.planId ?? ""} required><option value="" disabled>Selecione</option>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name} · {plan.trialEnabled ? `${String(plan.trialDays)} dias de teste` : "sem período de teste"}</option>)}</select></div><label className="k-field"><span>Período de teste</span><span className="console-checkbox-row"><input name="useTrial" type="checkbox" />Iniciar período de teste permitido pelo plano</span></label></div>{message ? <div className="k-status" role="status">{message}</div> : null}<div className="k-actions"><button className="k-button k-button--primary" type="submit">Aplicar plano</button></div></form>;
}

function StatusActions({ detail, onChanged }: DetailProps): React.JSX.Element {
  const [message, setMessage] = useState("");
  async function change(status: "active" | "suspended"): Promise<void> {
    try {
      await setControlMerchantStatusAction({ data: { storeId: detail.merchant.id, status } });
      setMessage(status === "active" ? "Loja reativada." : "Loja suspensa.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar o status da loja.");
    }
  }
  return <div className="control-card"><h3>Status da loja</h3><p>Estado atual: <span className="control-badge">{statusLabel(detail.merchant.status)}</span></p><div className="k-actions"><button className="k-button" disabled={detail.merchant.status === "active"} onClick={() => { void change("active"); }} type="button">Reativar loja</button><button className="k-button" disabled={detail.merchant.status === "suspended"} onClick={() => { if (confirmDangerousAction("Suspender esta loja? O painel administrativo e a operação pública podem ficar indisponíveis enquanto ela estiver suspensa.")) void change("suspended"); }} type="button">Suspender loja</button></div>{message ? <div className="k-status" role="status">{message}</div> : null}</div>;
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
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar a assinatura.");
    }
  }
  async function charge(): Promise<void> {
    if (!detail.merchant.subscriptionId) return;
    try {
      const result = await createControlTenantCharge({ data: { storeId: detail.merchant.id, subscriptionId: detail.merchant.subscriptionId } });
      setMessage(result.created ? "Cobrança criada." : "Já existe uma cobrança equivalente para este ciclo.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar a cobrança.");
    }
  }
  return <div className="control-card"><h3>Assinatura e cobranças</h3><div className="console-fact-list"><div className="console-fact-row"><div><strong>Status</strong><small>Cobrança do lojista</small></div><span className="control-badge">{detail.merchant.subscriptionStatus ? statusLabel(detail.merchant.subscriptionStatus) : "Sem assinatura"}</span></div><div className="console-fact-row"><div><strong>Período de teste</strong><small>Data final configurada</small></div><b>{detail.merchant.trialEndsAt ? new Date(detail.merchant.trialEndsAt).toLocaleDateString("pt-BR") : "—"}</b></div><div className="console-fact-row"><div><strong>Período atual</strong><small>Data final do ciclo</small></div><b>{detail.merchant.currentPeriodEndsAt ? new Date(detail.merchant.currentPeriodEndsAt).toLocaleDateString("pt-BR") : "—"}</b></div></div>{detail.merchant.subscriptionId ? <div className="k-actions"><button className="k-button k-button--primary" type="button" onClick={() => { void charge(); }}>Gerar cobrança</button><button className="k-button" type="button" onClick={() => { void change("active"); }}>Ativar assinatura</button><button className="k-button" type="button" onClick={() => { if (confirmDangerousAction("Suspender esta assinatura? O acesso comercial do lojista poderá ser limitado enquanto ela estiver suspensa.")) void change("suspended"); }}>Suspender assinatura</button><button className="k-button" type="button" onClick={() => { if (confirmDangerousAction("Cancelar esta assinatura? Uma assinatura encerrada não deve ser reativada pelo fluxo normal.")) void change("canceled"); }}>Cancelar assinatura</button>{detail.merchant.subscriptionStatus === "trialing" ? <button className="k-button" type="button" onClick={() => { if (confirmDangerousAction("Encerrar agora o período de teste desta loja?")) void change("expired"); }}>Encerrar período de teste</button> : null}</div> : null}{message ? <div className="k-status" role="status">{message}</div> : null}</div>;
}

function RelatedData({ detail, onChanged }: Pick<DetailProps, "detail" | "onChanged">): React.JSX.Element {
  const [message, setMessage] = useState("");
  async function reconcile(paymentId: string): Promise<void> {
    try {
      await reconcileControlTenantPayment({ data: { storeId: detail.merchant.id, paymentId } });
      setMessage("Pagamento reconciliado.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível reconciliar o pagamento.");
    }
  }
  return <div className="control-grid control-grid--two"><div className="control-card"><h3>Equipe e acessos</h3>{detail.members.length ? detail.members.map((member) => <div className="control-row" key={member.userId}><div><strong>{member.email ?? member.userId}</strong><small>{roleLabel(member.role)}</small></div></div>) : <div className="control-empty">Nenhum acesso cadastrado.</div>}</div><div className="control-card"><h3>Domínios</h3>{detail.domains.length ? detail.domains.map((domain) => <div className="control-row" key={domain.id}><div><strong>{domain.hostname}</strong><small>{domainTypeLabel(domain.type)} · {statusLabel(domain.status)}</small></div></div>) : <div className="control-empty">Nenhum domínio da loja.</div>}</div><div className="control-card"><h3>Recursos e limites do plano</h3>{detail.entitlements.length ? detail.entitlements.map((item) => <div className="control-row" key={item.key}><div><strong>{item.name}</strong><small>{item.kind === "feature" ? (item.enabled ? "Disponível" : "Indisponível") : `Limite: ${String(item.limitValue ?? 0)}`}</small></div></div>) : <div className="control-empty">Plano sem recursos e limites configurados.</div>}</div><div className="control-card"><h3>Pagamentos do lojista</h3>{detail.payments.length ? detail.payments.map((payment) => <div className="control-row" key={payment.id}><div><strong>{money(payment.amountCents)}</strong><small>{payment.provider} · {statusLabel(payment.status)} · {new Date(payment.createdAt).toLocaleString("pt-BR")}</small></div><button className="k-button" type="button" onClick={() => { void reconcile(payment.id); }}>Reconciliar</button></div>) : <div className="control-empty">Nenhum pagamento.</div>}{message ? <div className="k-status" role="status">{message}</div> : null}</div></div>;
}

export function ControlMerchantDetailPanel(props: DetailProps & Readonly<{ onClose: () => void }>): React.JSX.Element {
  const trialLabel = props.detail.merchant.trialEndsAt ? new Date(props.detail.merchant.trialEndsAt).toLocaleDateString("pt-BR") : "Sem período de teste";
  return (
    <div className="control-section control-merchant-detail">
      <div className="control-page-header">
        <div><span className="console-page-kicker">Detalhes da loja</span><h1>{props.detail.merchant.name}</h1><p>{props.detail.merchant.slug} · {props.detail.merchant.ownerEmail ?? "sem responsável principal"}</p></div>
        <button className="k-button" type="button" onClick={props.onClose}>Fechar detalhes</button>
      </div>

      <div className="control-summary-surface" aria-label="Resumo da loja">
        <div className="control-summary-item"><span>Status da loja</span><strong>{statusLabel(props.detail.merchant.status)}</strong><small>Estado operacional</small></div>
        <div className="control-summary-item"><span>Plano</span><strong>{props.detail.merchant.planName ?? "Sem plano"}</strong><small>Oferta atual</small></div>
        <div className="control-summary-item"><span>Assinatura</span><strong>{statusLabel(props.detail.merchant.subscriptionStatus)}</strong><small>Cobrança do lojista</small></div>
        <div className="control-summary-item"><span>Período de teste</span><strong>{trialLabel}</strong><small>Data final configurada</small></div>
      </div>

      <section className="console-detail-section">
        <div className="console-section-heading"><span>Identidade</span><h2>Loja e responsável</h2><p>Dados principais e responsável pela loja.</p></div>
        <div className="control-grid control-grid--two"><StoreEditor {...props} /><OwnerEditor {...props} /></div>
      </section>

      <section className="console-detail-section">
        <div className="console-section-heading"><span>Comercial</span><h2>Plano, assinatura e cobrança</h2><p>Configuração comercial e ciclo financeiro do lojista.</p></div>
        <div className="control-grid control-grid--two"><PlanEditor {...props} /><SubscriptionActions {...props} /></div>
      </section>

      <section className="console-detail-section">
        <div className="console-section-heading"><span>Administração</span><h2>Acessos e recursos vinculados</h2><p>Status da loja, equipe, domínios, recursos do plano e pagamentos.</p></div>
        <StatusActions {...props} />
        <RelatedData detail={props.detail} onChanged={props.onChanged} />
      </section>
    </div>
  );
}
