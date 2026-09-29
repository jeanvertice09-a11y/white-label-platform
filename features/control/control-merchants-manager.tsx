import { useState } from "react";
import type { ControlMerchantWorkspace, ControlStoreStatus } from "../../lib/server/control-merchants.types.ts";
import { searchControlMerchants } from "../../lib/server/control-merchants.functions.ts";
import { statusLabel } from "../../lib/ui-labels.ts";
import { ControlMerchantCreateForm } from "./control-merchant-create-form.tsx";

type StatusFilter = "all" | ControlStoreStatus;

function MerchantList(props: Readonly<{
  list: ControlMerchantWorkspace["list"];
  query: string;
  status: StatusFilter;
  message: string;
  onQuery: (value: string) => void;
  onStatus: (value: StatusFilter) => void;
  onRefresh: (page: number) => void;
  onOpen: (id: string) => void;
}>): React.JSX.Element {
  return <section className="console-panel control-merchants-list"><div className="console-panel__header"><div><h2>Lojistas cadastrados</h2><p>{props.list.total} lojas encontradas</p></div></div><div className="console-toolbar"><div className="console-toolbar__field console-toolbar__field--search"><label htmlFor="merchant-search">Buscar</label><input id="merchant-search" value={props.query} onChange={(event) => { props.onQuery(event.target.value); }} placeholder="Loja, slug ou e-mail" /></div><div className="console-toolbar__field"><label htmlFor="merchant-status">Status</label><select id="merchant-status" value={props.status} onChange={(event) => { props.onStatus(event.target.value as StatusFilter); }}><option value="all">Todos</option><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="suspended">Suspensa</option></select></div><button className="k-button" type="button" onClick={() => { props.onRefresh(1); }}>Aplicar filtros</button></div>{props.message ? <div className="k-status" role="status">{props.message}</div> : null}{props.list.items.length ? <div className="control-table-wrap"><table className="control-table"><thead><tr><th>Loja</th><th>Responsável</th><th>Status</th><th>Plano</th><th>Assinatura</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{props.list.items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.slug}</small></td><td>{item.ownerEmail ?? "—"}</td><td><span className="control-badge">{statusLabel(item.status)}</span></td><td>{item.planName ?? "Sem plano"}</td><td>{item.subscriptionStatus ? <span className="control-badge">{statusLabel(item.subscriptionStatus)}</span> : "—"}</td><td className="console-table-action"><button className="k-button" type="button" onClick={() => { props.onOpen(item.id); }}>Abrir</button></td></tr>)}</tbody></table></div> : <div className="control-empty"><strong>Nenhum lojista encontrado</strong><p>Ajuste a busca ou cadastre uma nova loja.</p></div>}<div className="console-pagination"><button className="k-button" disabled={props.list.page <= 1} type="button" onClick={() => { props.onRefresh(props.list.page - 1); }}>Anterior</button><span>Página {props.list.page} de {props.list.pageCount} · {props.list.total} lojas</span><button className="k-button" disabled={props.list.page >= props.list.pageCount} type="button" onClick={() => { props.onRefresh(props.list.page + 1); }}>Próxima</button></div></section>;
}

export function ControlMerchantsManager({ initial, onOpenStore }: Readonly<{ initial: ControlMerchantWorkspace; onOpenStore: (storeId: string) => void }>): React.JSX.Element {
  const [list, setList] = useState(initial.list);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [message, setMessage] = useState("");
  async function refresh(page = list.page): Promise<void> {
    try { setList(await searchControlMerchants({ data: { query, status, page, pageSize: list.pageSize } })); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao listar lojistas."); }
  }
  return <section className="control-plan-management-shell"><div className="control-plan-management"><header><span>Lojistas</span><h2>Gestão de lojas</h2><p>Cadastre lojistas, encontre rapidamente uma loja e abra o contexto completo de assinatura e operação.</p></header><ControlMerchantCreateForm plans={initial.plans} onCreated={() => refresh(1)} /><MerchantList list={list} query={query} status={status} message={message} onQuery={setQuery} onStatus={setStatus} onRefresh={(page) => { void refresh(page); }} onOpen={onOpenStore} /></div></section>;
}
