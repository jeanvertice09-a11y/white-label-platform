import type { MerchantCustomerInsights } from "../../lib/server/customer-insights.functions.ts";
import { formatMoney } from "./format.ts";

function patternLabel(insights: MerchantCustomerInsights): string {
  if (insights.completedOrders === 0) return "Sem compras concluídas";
  if (insights.completedOrders === 1) return "Uma compra concluída";
  return "Recorrente (2+ compras concluídas)";
}

function days(value: number | null): string {
  return value === null ? "—" : `${String(value)} dia(s)`;
}

export function CustomerInsightsPanel({ insights }: Readonly<{ insights: MerchantCustomerInsights }>): React.JSX.Element {
  return <section className="k-document-section">
    <header className="k-document-section__head"><div><span className="k-section-kicker">Relacionamento</span><h2>Métricas do cliente</h2></div><span>{patternLabel(insights)}</span></header>
    <div className="k-grid">
      <article className="k-card k-stat"><div className="k-stat__label">Compras concluídas</div><div className="k-stat__value">{insights.completedOrders}</div></article>
      <article className="k-card k-stat"><div className="k-stat__label">Total comprado</div><div className="k-stat__value">{formatMoney(insights.totalSpentCents)}</div></article>
      <article className="k-card k-stat"><div className="k-stat__label">Ticket médio</div><div className="k-stat__value">{insights.completedOrders ? formatMoney(insights.averageTicketCents) : "—"}</div></article>
      <article className="k-card k-stat"><div className="k-stat__label">Recência</div><div className="k-stat__value">{days(insights.recencyDays)}</div><div className="k-row__meta">Desde a última compra concluída</div></article>
    </div>
    <dl className="k-detail-list">
      <div><dt>Primeira compra</dt><dd>{insights.firstPurchaseAt ? new Date(insights.firstPurchaseAt).toLocaleString("pt-BR") : "—"}</dd></div>
      <div><dt>Última compra</dt><dd>{insights.lastPurchaseAt ? new Date(insights.lastPurchaseAt).toLocaleString("pt-BR") : "—"}</dd></div>
      <div><dt>Intervalo médio observado</dt><dd>{days(insights.averageDaysBetweenPurchases)}</dd></div>
    </dl>
    <header className="k-document-section__head"><div><span className="k-section-kicker">Histórico agregado</span><h2>Produtos comprados</h2></div></header>
    {!insights.products.length ? <div className="k-inline-state">Nenhum produto em compra concluída.</div> : <div className="k-table-wrap k-table-wrap--flush"><table className="k-table"><thead><tr><th>Produto</th><th>Pedidos</th><th>Quantidade</th><th className="k-align-right">Total dos itens</th><th>Última compra</th></tr></thead><tbody>{insights.products.map((item) => <tr key={`${item.productId ?? "snapshot"}-${item.productName}`}><td><strong>{item.productName}</strong></td><td>{item.orderCount}</td><td>{item.quantity}</td><td className="k-align-right k-money">{formatMoney(item.salesCents)}</td><td>{new Date(item.lastPurchasedAt).toLocaleDateString("pt-BR")}</td></tr>)}</tbody></table></div>}
    <p className="k-muted">Recência e intervalo são indicadores determinísticos do histórico disponível; não representam previsão de comportamento.</p>
  </section>;
}
