import { useState } from "react";
import type {
  ControlMerchantDetail,
  ControlMerchantWorkspace,
  ControlStoreStatus,
} from "../../lib/server/control-merchants.types.ts";
import {
  getControlMerchant,
  searchControlMerchants,
} from "../../lib/server/control-merchants.functions.ts";
import { ControlMerchantCreateForm } from "./control-merchant-create-form.tsx";
import { ControlMerchantDetailPanel } from "./control-merchant-detail.tsx";

type StatusFilter = "all" | ControlStoreStatus;

export function ControlMerchantsManager({ initial }: Readonly<{
  initial: ControlMerchantWorkspace;
}>): React.JSX.Element {
  const [list, setList] = useState(initial.list);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [detail, setDetail] = useState<ControlMerchantDetail | null>(null);
  const [message, setMessage] = useState("");

  async function refresh(page = list.page): Promise<void> {
    try {
      const next = await searchControlMerchants({ data: { query, status, page, pageSize: list.pageSize } });
      setList(next);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao listar lojistas.");
    }
  }

  async function open(storeId: string): Promise<void> {
    try {
      const next = await getControlMerchant({ data: { storeId } });
      if (!next) throw new Error("Loja não encontrada nesta White Label.");
      setDetail(next);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao abrir lojista.");
    }
  }

  async function refreshDetail(): Promise<void> {
    if (!detail) return;
    const next = await getControlMerchant({ data: { storeId: detail.merchant.id } });
    setDetail(next);
    await refresh();
  }

  return (
    <section className="control-plan-management-shell" id="merchant-management">
      <div className="control-plan-management">
        <header>
          <span>Lojistas</span>
          <h2>Gestão de lojas</h2>
          <p>Cadastre lojistas, encontre rapidamente uma loja e abra o contexto completo de assinatura e operação.</p>
        </header>

        <ControlMerchantCreateForm plans={initial.plans} onCreated={() => refresh(1)} />

        <section className="console-panel control-merchants-list">
          <div className="console-panel__header"><div><h2>Lojistas cadastrados</h2><p>{list.total} lojas encontradas</p></div></div>
          <div className="console-toolbar">
            <div className="console-toolbar__field console-toolbar__field--search"><label htmlFor="merchant-search">Buscar</label><input id="merchant-search" value={query} onChange={(event) => { setQuery(event.target.value); }} placeholder="Loja, slug ou e-mail" /></div>
            <div className="console-toolbar__field"><label htmlFor="merchant-status">Status</label><select id="merchant-status" value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); }}><option value="all">Todos</option><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="suspended">Suspensa</option></select></div>
            <button className="k-button" type="button" onClick={() => { void refresh(1); }}>Aplicar filtros</button>
          </div>
          {message ? <div className="k-status" role="status">{message}</div> : null}
          {list.items.length ? (
            <div className="control-table-wrap">
              <table className="control-table">
                <thead><tr><th>Loja</th><th>Responsável</th><th>Status</th><th>Plano</th><th>Assinatura</th><th><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>{list.items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong><small>{item.slug}</small></td>
                    <td>{item.ownerEmail ?? "—"}</td>
                    <td><span className="control-badge">{item.status}</span></td>
                    <td>{item.planName ?? "Sem plano"}</td>
                    <td>{item.subscriptionStatus ? <span className="control-badge">{item.subscriptionStatus}</span> : "—"}</td>
                    <td className="console-table-action"><button className="k-button" type="button" onClick={() => { void open(item.id); }}>Abrir</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="control-empty"><strong>Nenhum lojista encontrado</strong><p>Ajuste a busca ou cadastre uma nova loja.</p></div>}
          <div className="console-pagination">
            <button className="k-button" disabled={list.page <= 1} type="button" onClick={() => { void refresh(list.page - 1); }}>Anterior</button>
            <span>Página {list.page} de {list.pageCount} · {list.total} lojas</span>
            <button className="k-button" disabled={list.page >= list.pageCount} type="button" onClick={() => { void refresh(list.page + 1); }}>Próxima</button>
          </div>
        </section>

        {detail ? <ControlMerchantDetailPanel detail={detail} plans={initial.plans} onChanged={refreshDetail} onClose={() => { setDetail(null); }} /> : null}
      </div>
    </section>
  );
}
