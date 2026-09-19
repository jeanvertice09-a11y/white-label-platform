import { useState } from "react";
import type { TenantBillingWorkspace } from "../../lib/server/tenant-billing.types.ts";
import { searchControlTenantBilling } from "../../lib/server/tenant-billing.functions.ts";

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function date(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

export function ControlTenantBilling({ initial }: Readonly<{ initial: TenantBillingWorkspace }>): React.JSX.Element {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "trialing" | "active" | "past_due" | "suspended" | "canceled" | "expired">("all");
  const [busy, setBusy] = useState(false);

  async function search(page = 1): Promise<void> {
    setBusy(true);
    try {
      const next = await searchControlTenantBilling({ data: { query, status, page, pageSize: data.pageSize } });
      setData(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="control-section" id="tenant-billing">
      <div className="control-section__head">
        <div>
          <span className="control-kicker">Faturamento White Label → lojistas</span>
          <h2>Assinaturas e pagamentos</h2>
          <p>Acompanhe a situação financeira real das lojas sem misturar platform_billing ou checkout.</p>
        </div>
        <span className="console-status">{data.gatewayReady ? "Gateway configurado" : "Gateway pendente"}</span>
      </div>

      <div className="control-summary-surface" aria-label="Resumo do faturamento">
        <div className="control-summary-item"><span>Assinaturas ativas</span><strong>{data.metrics.subscriptionsActive}</strong><small>Em operação</small></div>
        <div className="control-summary-item"><span>Trials</span><strong>{data.metrics.subscriptionsTrialing}</strong><small>Períodos de teste</small></div>
        <div className="control-summary-item"><span>Em atraso</span><strong>{data.metrics.subscriptionsPastDue}</strong><small>Status past_due</small></div>
        <div className="control-summary-item"><span>Receita recebida</span><strong>{money(data.metrics.revenueCapturedCents)}</strong><small>{data.metrics.paymentsCaptured} pagamentos capturados</small></div>
      </div>

      <section className="console-panel">
        <div className="console-panel__header">
          <div><h2>Assinaturas dos lojistas</h2><p>{data.total} registros encontrados</p></div>
        </div>
        <div className="console-toolbar">
          <div className="console-toolbar__field console-toolbar__field--search"><label htmlFor="billing-search">Buscar</label><input id="billing-search" value={query} onChange={(event) => { setQuery(event.target.value); }} placeholder="Loja ou plano" /></div>
          <div className="console-toolbar__field"><label htmlFor="billing-status">Status</label><select id="billing-status" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); }}><option value="all">Todos</option><option value="trialing">Trial</option><option value="active">Ativo</option><option value="past_due">Past due</option><option value="suspended">Suspenso</option><option value="canceled">Cancelado</option><option value="expired">Expirado</option></select></div>
          <button className="k-button" disabled={busy} type="button" onClick={() => { void search(1); }}>Aplicar filtros</button>
        </div>
        {data.subscriptions.length ? (
          <div className="control-table-wrap">
            <table className="control-table">
              <thead><tr><th>Loja</th><th>Plano</th><th>Status</th><th>Trial / período</th><th>Último pagamento</th><th>Valor</th></tr></thead>
              <tbody>{data.subscriptions.map((item) => (
                <tr key={item.subscriptionId}>
                  <td><strong>{item.storeName}</strong><small>{item.storeId}</small></td>
                  <td>{item.planName}</td>
                  <td><span className="control-badge">{item.status}</span></td>
                  <td><strong>{item.trialEndsAt ? `Trial até ${date(item.trialEndsAt)}` : "Sem trial ativo"}</strong><small>Período até {date(item.currentPeriodEndsAt)}</small></td>
                  <td>{item.lastPaymentStatus ? <><span className="control-badge">{item.lastPaymentStatus}</span><small>{date(item.lastPaymentCreatedAt)}</small></> : "—"}</td>
                  <td className="console-money">{item.lastPaymentAmountCents === null ? "—" : money(item.lastPaymentAmountCents)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="control-empty"><strong>Nenhuma assinatura encontrada</strong><p>Ajuste a busca ou os filtros para localizar outro registro.</p></div>}
        <div className="console-pagination">
          <button className="k-button" disabled={busy || data.page <= 1} type="button" onClick={() => { void search(data.page - 1); }}>Anterior</button>
          <span>Página {data.page} de {data.pageCount}</span>
          <button className="k-button" disabled={busy || data.page >= data.pageCount} type="button" onClick={() => { void search(data.page + 1); }}>Próxima</button>
        </div>
      </section>
    </section>
  );
}
