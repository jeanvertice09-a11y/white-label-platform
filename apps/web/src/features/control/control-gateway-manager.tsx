import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type {
  ControlGatewayWorkspace,
  SafeGatewayAccount,
} from "../../lib/server/control-gateways.types.ts";
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
      <label>
        Nova credencial secreta
        <input name="credentials" type="password" autoComplete="new-password" />
      </label>
      <label>
        Novo webhook secret
        <input name="webhookSecret" type="password" autoComplete="new-password" />
      </label>
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
    setBusy(true);
    setMessage("");
    try {
      await createControlGatewayAccount({
        data: {
          provider: text(form, "provider") === "asaas" ? "asaas" : "mercadopago",
          label: text(form, "label"),
          publicIdentifier: nullableText(form, "publicIdentifier"),
          credentials: text(form, "credentials"),
          webhookSecret: text(form, "webhookSecret"),
        },
      });
      event.currentTarget.reset();
      setMessage("Conta de gateway salva com credenciais protegidas no servidor.");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar gateway.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="k-form" onSubmit={(event) => { void submit(event); }}>
      <div className="k-form__grid">
        <label>Provider<select name="provider"><option value="mercadopago">Mercado Pago</option><option value="asaas">Asaas</option></select></label>
        <label>Nome<input name="label" required maxLength={120} /></label>
        <label>Identificador público<input name="publicIdentifier" maxLength={255} /></label>
        <SecretFields />
      </div>
      <p className="k-muted">Esta área configura somente White Label → lojista. O nível financeiro é definido no servidor.</p>
      <button className="k-button" disabled={busy}>Criar conta</button>
      {message ? <p className="k-status">{message}</p> : null}
    </form>
  );
}

function GatewayAccountCard({ account }: Readonly<{ account: SafeGatewayAccount }>): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string): Promise<void> {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na operação de gateway.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(
      () => updateControlGatewayAccount({
        data: {
          gatewayAccountId: account.id,
          label: text(form, "label"),
          publicIdentifier: nullableText(form, "publicIdentifier"),
          credentials: text(form, "credentials"),
          webhookSecret: text(form, "webhookSecret"),
        },
      }),
      "Configuração atualizada. Campos secretos vazios preservam os valores existentes.",
    );
    event.currentTarget.reset();
  }

  const nextStatus = account.status === "active" ? "disabled" : "active";
  return (
    <article className="master-card">
      <form className="k-form" onSubmit={(event) => { void submit(event); }}>
        <p><strong>{account.provider}</strong> · {account.level} · {account.status}</p>
        <p className="k-muted">Credencial: {account.configured ? "configurada" : "não configurada"} · Webhook secret: {account.webhookConfigured ? "configurado" : "não configurado"}</p>
        <div className="k-form__grid">
          <label>Nome<input name="label" defaultValue={account.label} required maxLength={120} /></label>
          <label>Identificador público<input name="publicIdentifier" defaultValue={account.publicIdentifier ?? ""} maxLength={255} /></label>
          <SecretFields />
        </div>
        <div className="k-actions">
          <button className="k-button" disabled={busy}>Salvar</button>
          <button
            type="button"
            className="k-button"
            disabled={busy}
            onClick={() => {
              void run(
                () => setControlGatewayAccountStatus({
                  data: { gatewayAccountId: account.id, status: nextStatus },
                }),
                nextStatus === "disabled" ? "Gateway desabilitado." : "Gateway habilitado.",
              );
            }}
          >
            {nextStatus === "disabled" ? "Desabilitar" : "Habilitar"}
          </button>
        </div>
        {message ? <p className="k-status">{message}</p> : null}
      </form>
    </article>
  );
}

export function ControlGatewayManager({
  initial,
}: Readonly<{ initial: ControlGatewayWorkspace }>): React.JSX.Element {
  return (
    <section className="control-plan-management-shell" id="gateway-management">
      <div className="control-plan-management">
        <header>
          <span>Gateways</span>
          <h2>Credenciais seguras de pagamento</h2>
          <p>Nenhum segredo existente é devolvido ao navegador. Cobrança real permanece desativada nesta fase.</p>
        </header>
        {initial.canManage ? (
          <>
            <CreateGatewayForm />
            {initial.accounts.length
              ? initial.accounts.map((account) => <GatewayAccountCard key={account.id} account={account} />)
              : <p className="k-muted">Nenhuma conta de gateway configurada.</p>}
          </>
        ) : <p className="k-muted">Gestão de gateways requer tenant_owner/admin.</p>}
      </div>
    </section>
  );
}
