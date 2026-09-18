import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { DomainType } from "@white-label/domains";
import type { ControlDomainItem, ControlDomainWorkspace } from "../../lib/server/control-domains.types.ts";
import {
  createControlDomainAction,
  deleteControlDomainAction,
  setControlDomainStatusAction,
  updateControlDomainAction,
  verifyControlDomainAction,
} from "../../lib/server/control-domains.functions.ts";

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
      setMessage("Domínio cadastrado como pending. Configure o DNS antes de verificar.");
      event.currentTarget.reset();
      await router.invalidate();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao cadastrar domínio."); }
    finally { setBusy(false); }
  }
  return <form className="k-form" onSubmit={(event) => { void submit(event); }}><div className="k-form__grid"><label>Hostname<input name="hostname" placeholder="loja.exemplo.com" required/></label><label>Tipo<select name="type" defaultValue="tenant_panel"><option value="tenant_panel">Painel White Label</option><option value="tenant_site">Site White Label</option><option value="store_admin">Admin da loja</option><option value="store_catalog">Catálogo da loja</option></select></label><label>Loja<select name="storeId" defaultValue=""><option value="">Nenhuma</option>{initial.stores.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.status}</option>)}</select></label></div><button className="k-button" disabled={busy}>Cadastrar domínio</button>{message ? <p className="k-status">{message}</p> : null}</form>;
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
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha na operação de domínio."); }
    finally { setBusy(false); }
  }
  async function edit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await run(() => updateControlDomainAction({ data: { domainId: domain.id, hostname: text(form, "hostname"), type: typeValue(text(form, "type")), storeId: storeValue(form) } }), "Domínio atualizado. Nova verificação DNS é obrigatória.");
  }
  return <article className="master-card"><form className="k-form" onSubmit={(event) => { void edit(event); }}><div className="k-form__grid"><label>Hostname<input name="hostname" defaultValue={domain.hostname}/></label><label>Tipo<select name="type" defaultValue={domain.type}><option value="tenant_panel">tenant_panel</option><option value="tenant_site">tenant_site</option><option value="store_admin">store_admin</option><option value="store_catalog">store_catalog</option></select></label><label>Loja<select name="storeId" defaultValue={domain.storeId ?? ""}><option value="">Nenhuma</option>{initial.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label></div><p className="k-muted">Tenant: {domain.tenantId} · Loja: {domain.storeName ?? "—"} · Status: {domain.status} · Criado: {domain.createdAt} · Verificado: {domain.verifiedAt ?? "não"}</p><DnsInstructions domain={domain} fallback={initial.configurationMessage}/><div className="k-actions"><button className="k-button" disabled={busy}>Salvar</button>{domain.status === "pending" ? <button className="k-button" type="button" disabled={busy} onClick={() => { void run(() => verifyControlDomainAction({ data: { domainId: domain.id } }), "Verificação concluída."); }}>Verificar domínio</button> : null}<button className="k-button" type="button" disabled={busy} onClick={() => { void run(() => setControlDomainStatusAction({ data: { domainId: domain.id, status: domain.status === "suspended" ? "pending" : "suspended" } }), domain.status === "suspended" ? "Domínio voltou para pending." : "Domínio suspenso."); }}>{domain.status === "suspended" ? "Reabrir" : "Suspender"}</button><button className="k-button" type="button" disabled={busy} onClick={() => { void run(() => deleteControlDomainAction({ data: { domainId: domain.id } }), "Domínio removido."); }}>Remover</button></div>{message ? <p className="k-status">{message}</p> : null}</form></article>;
}

export function ControlDomainManager({ initial }: Readonly<{ initial: ControlDomainWorkspace }>): React.JSX.Element {
  return <section className="control-plan-management-shell" id="domain-management"><div className="control-plan-management"><header><span>Domínios</span><h2>Onboarding e verificação DNS</h2><p>Somente domínios com evidência DNS real podem ficar ativos.</p></header>{initial.canManage ? <><p className="k-status">Provider: {initial.providerName} · {initial.configurationMessage}</p><DomainCreateForm initial={initial}/>{initial.domains.length ? initial.domains.map((domain) => <DomainCard key={domain.id} domain={domain} initial={initial}/>) : <p className="k-muted">Nenhum domínio cadastrado.</p>}</> : <p className="k-muted">Gestão de domínios requer tenant_owner/admin.</p>}</div></section>;
}
