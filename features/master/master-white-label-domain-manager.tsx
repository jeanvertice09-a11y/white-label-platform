import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { MasterWhiteLabelDetail } from "../../lib/server/master-white-label.types.ts";
import { confirmDangerousAction } from "../../lib/ui-confirm.ts";
import { domainTypeLabel, statusLabel } from "../../lib/ui-labels.ts";
import { createMasterDomain, setMasterDomainStatus, updateMasterDomain } from "../../lib/server/master-white-label.functions.ts";

type DomainTypeInput = "tenant_panel" | "tenant_site" | "store_admin" | "store_catalog";
const DOMAIN_TYPES: readonly DomainTypeInput[] = ["tenant_panel", "tenant_site", "store_admin", "store_catalog"];
function formText(form: FormData, key: string, fallback = ""): string { const value = form.get(key); return typeof value === "string" ? value : fallback; }
function domainType(form: FormData, key: string, fallback: DomainTypeInput): DomainTypeInput {
  const value = formText(form, key, fallback);
  if (value === "tenant_panel" || value === "tenant_site" || value === "store_admin" || value === "store_catalog") return value;
  return fallback;
}

function StoreSelect({ detail, name = "storeId", defaultValue = "" }: Readonly<{ detail: MasterWhiteLabelDetail; name?: string; defaultValue?: string }>): React.JSX.Element {
  return <select name={name} defaultValue={defaultValue}><option value="">Nenhuma loja</option>{detail.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select>;
}

export function MasterWhiteLabelDomainManager({ detail }: Readonly<{ detail: MasterWhiteLabelDetail }>): React.JSX.Element {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function create(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage("");
    try {
      await createMasterDomain({ data: { tenantId: detail.tenant.id, hostname: formText(form, "hostname"), type: domainType(form, "type", "tenant_panel"), storeId: formText(form, "storeId").trim() || null } });
      setMessage("Domínio criado. Faça a verificação antes de ativá-lo."); event.currentTarget.reset(); await router.invalidate();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível criar o domínio."); } finally { setBusy(false); }
  }
  async function edit(domain: MasterWhiteLabelDetail["domains"][number], form: HTMLFormElement): Promise<void> {
    const data = new FormData(form); setBusy(true); setMessage("");
    try {
      await updateMasterDomain({ data: { tenantId: detail.tenant.id, domainId: domain.id, hostname: formText(data, "hostname", domain.hostname), type: domainType(data, "type", domain.type), storeId: formText(data, "storeId").trim() || null } });
      setMessage("Domínio atualizado. Será necessária nova verificação antes da ativação."); await router.invalidate();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o domínio."); } finally { setBusy(false); }
  }
  async function changeStatus(domainId: string, status: "pending" | "suspended"): Promise<void> {
    setBusy(true); setMessage("");
    try { await setMasterDomainStatus({ data: { tenantId: detail.tenant.id, domainId, status } }); setMessage(status === "suspended" ? "Domínio suspenso." : "Domínio enviado novamente para verificação."); await router.invalidate(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível alterar o domínio."); } finally { setBusy(false); }
  }
  return <section className="master-card master-panel"><h2>Domínios</h2><p className="k-muted">Configure os endereços usados pelos painéis e lojas públicas desta White Label.</p><form className="k-form" onSubmit={(event) => { void create(event); }}><div className="k-form__grid"><div className="k-field"><label htmlFor="domain-host">Endereço</label><input id="domain-host" name="hostname" placeholder="exemplo.seudominio.com.br" required/></div><div className="k-field"><label htmlFor="domain-type">Uso do domínio</label><select id="domain-type" name="type" defaultValue="tenant_panel">{DOMAIN_TYPES.map((type) => <option key={type} value={type}>{domainTypeLabel(type)}</option>)}</select></div><div className="k-field"><label htmlFor="domain-store">Loja vinculada</label><StoreSelect detail={detail}/><small>Necessária apenas para painel administrativo da loja ou loja pública.</small></div></div><div className="k-actions"><button className="k-button" disabled={busy}>Adicionar domínio</button></div></form>{message ? <div className="k-status" role="status">{message}</div> : null}{detail.domains.length ? <div>{detail.domains.map((domain) => <form className="k-form" key={domain.id} onSubmit={(event) => { event.preventDefault(); void edit(domain, event.currentTarget); }}><div className="k-form__grid"><div className="k-field"><label>Endereço</label><input name="hostname" defaultValue={domain.hostname}/></div><div className="k-field"><label>Uso do domínio</label><select name="type" defaultValue={domain.type}>{DOMAIN_TYPES.map((type) => <option key={type} value={type}>{domainTypeLabel(type)}</option>)}</select></div><div className="k-field"><label>Loja vinculada</label><StoreSelect detail={detail} defaultValue={domain.storeId ?? ""}/></div></div><p className="k-muted">Status: {statusLabel(domain.status)} · Verificado: {domain.verifiedAt ? "Sim" : "Não"}</p><div className="k-actions"><button className="k-button" disabled={busy}>Salvar domínio</button><button className="k-button" type="button" disabled={busy} onClick={() => { const suspending = domain.status !== "suspended"; if (!suspending || confirmDangerousAction("Suspender este domínio? Ele deixará de ser considerado ativo até uma nova verificação/reativação.")) void changeStatus(domain.id, domain.status === "suspended" ? "pending" : "suspended"); }}>{domain.status === "suspended" ? "Enviar para verificação" : "Suspender domínio"}</button></div></form>)}</div> : <p className="k-muted">Nenhum domínio cadastrado.</p>}</section>;
}
