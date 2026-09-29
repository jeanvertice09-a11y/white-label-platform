import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type {
  ControlGatewayWorkspace,
  SafeGatewayAccount,
} from "../../lib/server/control-gateways.types.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";
import { billingLevelLabel, statusLabel } from "../../lib/ui-labels.ts";
import {
  createControlGatewayAccount,
  setControlGatewayAccountStatus,
  updateControlGatewayAccount,
} from "../../lib/server/control-gateways.functions.ts";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function nullableText(form: FormData, key: string): string | null {
  return text(form, key).trim() || null;
}

function SecretFields(): React.JSX.Element {
  return (
    <>
      <label>Nova credencial secreta<input name="credentials" type="password" autoComplete="new-password" /></label>
      <label>Novo segredo do webhook<input name="webhookSecret" type="password" autoComplete="new-password" /></label>
    </>
  );
}

function CreateGatewayForm(): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      await createControlGatewayAccount({ data: {
        provider: text(form, "provider") === "asaas" ? "asaas" : "mercadopago",
        label: text(form, "label"),
        publicIdentifier: nullableText(form, "publicIdentifier"),
        credentials: text(form, "credentials"),
        webhookSecret: text(form, "webhookSecret"),
      } });
      event.currentTarget.reset();
      setMessage("Meio de pagamento salvo com credenciais protegidas no servidor.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o meio de pagamento.");
    } finally { setBusy(false); }
  }
  return (
    <form className="k-form" onSubmit={(event) => { void submit(event); }}>
      <div className="k-form__grid">
        <label>Provedor<select name="provider"><option value="mercadopago">Mercado Pago</option><option value="asaas">Asaas</option></select></label>
        <label>Nome da configuração<input name="label" required maxLength={120} /></label>
        <label>Identificador público<input name="publicIdentifier" maxLength={255} /></label>
        <SecretFields />
      </div>
      <p className="k-muted">Esta configuração é usada somente na cobrança dos lojistas. O nível financeiro continua definido e validado no servidor.</p>
      <button className="k-button" disabled={busy}>Adicionar meio de pagamento</button>
      {message ? <p className="k-status" role="status">{message}</p> : null}
    </form>
  );
}

function AccountFields({ account }: Readonly<{ account: SafeGatewayAccount }>): React.JSX.Element {
  return (
    <div className="k-form__grid">
      <label>Nome da configuração<input name="label" defaultValue={account.label} required maxLength={120} /></label>
      <label>Identificador público<input name="publicIdentifier" defaultValue={account.publicIdentifier ?? ""} maxLength={255} /></label>
      <SecretFields />
    </div>
  );
}

function GatewayAccountCard({ account }: Readonly<{ account: SafeGatewayAccount }>): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>, success: string): Promise<void> {
    setBusy(true); setMessage("");
    try { await action(); setMessage(success); await router.invalidate(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação do meio de pagamento."); }
    finally { setBusy(false); }
  }
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => updateControlGatewayAccount({ data: {
      gatewayAccountId: account.id,
      label: text(form, "label"),
      publicIdentifier: nullableText(form, "publicIdentifier"),
      credentials: text(form, "credentials"),
      webhookSecret: text(form, "webhookSecret"),
    } }), "Configuração atualizada. Campos secretos vazios preservam os valores existentes.");
    event.currentTarget.reset();
  }
  const nextStatus = account.status === "active" ? "disabled" : "active";
  return (
    <article className="master-card"><form className="k-form" onSubmit={(event) => { void submit(event); }}>
      <p><strong>{account.provider}</strong> · {billingLevelLabel(account.level)} · {statusLabel(account.status)}</p>
      <p className="k-muted">Credencial: {account.configured ? "configurada" : "não configurada"} · Segredo do webhook: {account.webhookConfigured ? "configurado" : "não configurado"}</p>
      <AccountFields account={account} />
      <div className="k-actions">
        <button className="k-button" disabled={busy}>Salvar</button>
        <button type="button" className="k-button" disabled={busy} onClick={() => { if (nextStatus === "active" || confirmDangerousAction("Desabilitar este meio de pagamento? Novas cobranças não deverão usar esta configuração enquanto ela estiver desabilitada.")) void run(
          () => setControlGatewayAccountStatus({ data: { gatewayAccountId: account.id, status: nextStatus } }),
          nextStatus === "disabled" ? "Meio de pagamento desabilitado." : "Meio de pagamento habilitado.",
        ); }}>{nextStatus === "disabled" ? "Desabilitar" : "Habilitar"}</button>
      </div>
      {message ? <p className="k-status" role="status">{message}</p> : null}
    </form></article>
  );
}

export function ControlGatewayManager({
  initial,
}: Readonly<{ initial: ControlGatewayWorkspace }>): React.JSX.Element {
  return (
    <section className="control-plan-management-shell" id="gateway-management">
      <div className="control-plan-management">
        <header>
          <span>Meios de pagamento</span>
          <h2>Configuração de cobrança</h2>
          <p>Credenciais ficam protegidas no servidor. A conta ativa recebe diretamente as cobranças dos planos dos lojistas; mantenha somente uma configuração ativa.</p>
        </header>
        {initial.canManage ? (
          <>
            <CreateGatewayForm />
            {initial.accounts.length
              ? initial.accounts.map((account) => <GatewayAccountCard key={account.id} account={account} />)
              : <p className="k-muted">Nenhum meio de pagamento configurado.</p>}
          </>
        ) : <p className="k-muted">A gestão de meios de pagamento requer perfil Responsável principal ou Administrador.</p>}
      </div>
    </section>
  );
}
