import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { DomainType } from "@white-label/domains";
import type { ControlDomainItem, ControlDomainWorkspace } from "../../lib/server/control-domains.types.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";
import { domainTypeLabel, statusLabel } from "../../lib/ui-labels.ts";
import {
  createControlDomainAction,
  deleteControlDomainAction,
  setControlDomainStatusAction,
  updateControlDomainAction,
  verifyControlDomainAction,
} from "../../lib/server/control-domains.functions.ts";

const DOMAIN_TYPES: readonly DomainType[] = ["tenant_panel", "tenant_site", "store_admin", "store_catalog"];

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}
function typeValue(value: string): DomainType {
  if (value === "tenant_site" || value === "store_admin" || value === "store_catalog") return value;
  return "tenant_panel";
}
function storeValue(form: FormData): string | null {
  return text(form, "storeId").trim() || null;
}
function dateTime(value: string | null): string { return value ? new Date(value).toLocaleString("pt-BR") : "—"; }

function DomainCreateForm({ initial }: Readonly<{ initial: ControlDomainWorkspace }>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      await createControlDomainAction({ data: { hostname: text(form, "hostname"), type: typeValue(text(form, "type")), storeId: storeValue(form) } });
      setMessage("Domínio cadastrado. Configure o DNS e faça a verificação antes de ativá-lo.");
      event.currentTarget.reset();
      await router.invalidate();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar o domínio."); }
    finally { setBusy(false); }
  }
  return <form className="k-form" onSubmit={(event) => { void submit(event); }}><div className="k-form__grid"><label>Endereço<input name="hostname" placeholder="loja.exemplo.com" required/></label><label>Uso do domínio<select name="type" defaultValue="tenant_panel">{DOMAIN_TYPES.map((type) => <option key={type} value={type}>{domainTypeLabel(type)}</option>)}</select></label><label>Loja vinculada<select name="storeId" defaultValue=""><option value="">Nenhuma</option>{initial.stores.map((store) => <option key={store.id} value={store.id}>{store.name} · {statusLabel(store.status)}</option>)}</select></label></div><button className="k-button" disabled={busy}>Cadastrar domínio</button>{message ? <p className="k-status" role="status">{message}</p> : null}</form>;
}

function DnsInstructions({ domain, fallback }: Readonly<{ domain: ControlDomainItem; fallback: string }>): React.JSX.Element {
  if (domain.status === "active") return <p className="k-status">Domínio ativo e verificado.</p>;
  const plan = domain.dns;
  if (!plan?.available) return <p className="k-status">{plan?.message ?? fallback}</p>;
  return <div><p>{plan.message}</p>{plan.records.map((record) => <div key={`${record.type}-${record.host}`} className="k-status"><strong>{record.type}</strong> · Host: <code>{record.host}</code> · Valor: <code>{record.value}</code></div>)}</div>;
}

function DomainCard({ domain, initial }: Readonly<{ domain: ControlDomainItem; initial: ControlDomainWorkspace }>): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<unknown>, success: string): Promise<void> {
    setBusy(true); setMessage("");
    try { await action(); setMessage(success); await router.invalidate(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação de domínio."); }
    finally { setBusy(false); }
  }
  async function edit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await run(() => updateControlDomainAction({ data: { domainId: domain.id, hostname: text(form, "hostname"), type: typeValue(text(form, "type")), storeId: storeValue(form) } }), "Domínio atualizado. Faça uma nova verificação DNS antes da ativação.");
  }
  return <article className="master-card"><form className="k-form" onSubmit={(event) => { void edit(event); }}><div className="k-form__grid"><label>Endereço<input name="hostname" defaultValue={domain.hostname}/></label><label>Uso do domínio<select name="type" defaultValue={domain.type}>{DOMAIN_TYPES.map((type) => <option key={type} value={type}>{domainTypeLabel(type)}</option>)}</select></label><label>Loja vinculada<select name="storeId" defaultValue={domain.storeId ?? ""}><option value="">Nenhuma</option>{initial.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label></div><p className="k-muted">Loja: {domain.storeName ?? "Nenhuma"} · Status: {statusLabel(domain.status)} · Criado: {dateTime(domain.createdAt)} · Verificado: {domain.verifiedAt ? dateTime(domain.verifiedAt) : "Não"}</p><DnsInstructions domain={domain} fallback={initial.configurationMessage}/><div className="k-actions"><button className="k-button" disabled={busy}>Salvar</button>{domain.status === "pending" ? <button className="k-button" type="button" disabled={busy} onClick={() => { void run(() => verifyControlDomainAction({ data: { domainId: domain.id } }), "Verificação concluída."); }}>Verificar domínio</button> : null}<button className="k-button" type="button" disabled={busy} onClick={() => { const suspending = domain.status !== "suspended"; if (!suspending || confirmDangerousAction("Suspender este domínio? Ele deixará de ser considerado ativo até uma nova verificação/reativação.")) void run(() => setControlDomainStatusAction({ data: { domainId: domain.id, status: domain.status === "suspended" ? "pending" : "suspended" } }), domain.status === "suspended" ? "Domínio enviado para nova verificação." : "Domínio suspenso."); }}>{domain.status === "suspended" ? "Enviar para verificação" : "Suspender domínio"}</button><button className="k-button" type="button" disabled={busy} onClick={() => { if (confirmDangerousAction(`Remover o domínio ${domain.hostname}? Ele deixará de fazer parte da configuração desta White Label.`)) void run(() => deleteControlDomainAction({ data: { domainId: domain.id } }), "Domínio removido."); }}>Remover domínio</button></div>{message ? <p className="k-status" role="status">{message}</p> : null}</form></article>;
}

export function ControlDomainManager({ initial }: Readonly<{ initial: ControlDomainWorkspace }>): React.JSX.Element {
  return <section className="control-plan-management-shell" id="domain-management"><div className="control-plan-management"><header><span>Domínios</span><h2>Configuração de domínio</h2><p>Cadastre endereços e acompanhe a verificação DNS antes da ativação.</p></header>{initial.canManage ? <><p className="k-status">Provedor DNS: {initial.providerName} · {initial.configurationMessage}</p><DomainCreateForm initial={initial}/>{initial.domains.length ? initial.domains.map((domain) => <DomainCard key={domain.id} domain={domain} initial={initial}/>) : <p className="k-muted">Nenhum domínio cadastrado.</p>}</> : <p className="k-muted">A gestão de domínios requer perfil Responsável principal ou Administrador.</p>}</div></section>;
}
