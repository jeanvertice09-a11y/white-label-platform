import { useState } from "react";
import type { TenantBillingWorkspace } from "../../lib/server/tenant-billing.types.ts";
import { searchControlTenantBilling } from "../../lib/server/tenant-billing.functions.ts";

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function ControlTenantBilling({ initial }: Readonly<{ initial: TenantBillingWorkspace }>): React.JSX.Element {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "trialing" | "active" | "past_due" | "suspended" | "canceled" | "expired">("all");
  const [busy, setBusy] = useState(false);

  async function search(page = 1): Promise<void> {
    setBusy(true);
    try {
      const next = await searchControlTenantBilling({
        data: { query, status, page, pageSize: data.pageSize },
      });
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
          <p>Somente dados reais de tenant_billing. {data.gatewayReady ? "Gateway ativo configurado." : "Gateway tenant_billing pendente."}</p>
        </div>
      </div>
      <div className="control-grid control-grid--four">
        <article className="control-card"><small>Ativas</small><strong>{data.metrics.subscriptionsActive}</strong></article>
        <article className="control-card"><small>Trials</small><strong>{data.metrics.subscriptionsTrialing}</strong></article>
        <article className="control-card"><small>Past due</small><strong>{data.metrics.subscriptionsPastDue}</strong></article>
        <article className="control-card"><small>Receita recebida</small><strong>{money(data.metrics.revenueCapturedCents)}</strong></article>
      </div>
      <div className="control-card">
        <div className="k-form__grid">
          <div className="k-field"><label htmlFor="billing-search">Buscar</label><input id="billing-search" value={query} onChange={(event) => { setQuery(event.target.value); }} /></div>
          <div className="k-field"><label htmlFor="billing-status">Status</label><select id="billing-status" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); }}><option value="all">Todos</option><option value="trialing">Trial</option><option value="active">Ativo</option><option value="past_due">Past due</option><option value="suspended">Suspenso</option><option value="canceled">Cancelado</option><option value="expired">Expirado</option></select></div>
        </div>
        <div className="k-actions"><button className="k-button" disabled={busy} type="button" onClick={() => { void search(1); }}>Filtrar</button></div>
        {data.subscriptions.length ? data.subscriptions.map((item) => (
          <div className="control-row" key={item.subscriptionId}>
            <div><strong>{item.storeName}</strong><small>{item.planName} · {item.status}</small></div>
            <div><strong>{item.lastPaymentAmountCents === null ? "—" : money(item.lastPaymentAmountCents)}</strong><small>{item.lastPaymentStatus ?? "sem pagamento"}</small></div>
          </div>
        )) : <div className="control-empty">Nenhuma assinatura encontrada.</div>}
        <div className="k-actions">
          <button className="k-button" disabled={busy || data.page <= 1} type="button" onClick={() => { void search(data.page - 1); }}>Anterior</button>
          <span>{data.page} / {data.pageCount}</span>
          <button className="k-button" disabled={busy || data.page >= data.pageCount} type="button" onClick={() => { void search(data.page + 1); }}>Próxima</button>
        </div>
      </div>
    </section>
  );
}
