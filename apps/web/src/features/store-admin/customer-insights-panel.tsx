import type { MerchantCustomerInsights } from "../../lib/server/customer-insights.functions.ts";
import { Section } from "../../admin/ui/Section.tsx";
import styles from "../../admin/ui/Section.module.css";
import { formatMoney } from "./format.ts";

function patternLabel(insights: MerchantCustomerInsights): string {
  if (insights.completedOrders === 0) return "Sem compras concluídas";
  if (insights.completedOrders === 1) return "Uma compra concluída";
  return "Cliente recorrente";
}

function days(value: number | null): string {
  if (value === null) return "Não disponível";
  return `${String(value)} ${value === 1 ? "dia" : "dias"}`;
}

function dateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "Não disponível";
}

export function CustomerInsightsPanel({ insights }: Readonly<{ insights: MerchantCustomerInsights }>): React.JSX.Element {
  return (
    <Section title="Métricas do cliente" description="Relacionamento e comportamento observado" action={<span className={styles.muted}>{patternLabel(insights)}</span>}>
      <div className={styles.statGrid}>
        <article className={styles.stat}><span>Compras concluídas</span><strong>{insights.completedOrders}</strong></article>
        <article className={styles.stat}><span>Total comprado</span><strong>{formatMoney(insights.totalSpentCents)}</strong></article>
        <article className={styles.stat}><span>Ticket médio</span><strong>{insights.completedOrders ? formatMoney(insights.averageTicketCents) : "Não disponível"}</strong></article>
        <article className={styles.stat}><span>Recência</span><strong>{days(insights.recencyDays)}</strong><small>Desde a última compra concluída</small></article>
      </div>
      <dl className={styles.detailList}>
        <div><dt>Primeira compra</dt><dd>{dateTime(insights.firstPurchaseAt)}</dd></div>
        <div><dt>Última compra</dt><dd>{dateTime(insights.lastPurchaseAt)}</dd></div>
        <div><dt>Intervalo médio observado</dt><dd>{days(insights.averageDaysBetweenPurchases)}</dd></div>
      </dl>
      <div className={styles.subsection}>
        <h3>Produtos comprados</h3>
        {!insights.products.length ? (
          <div className={styles.empty}>Nenhum produto em compra concluída.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Produto</th><th>Pedidos</th><th>Quantidade</th><th>Total dos itens</th><th>Última compra</th></tr></thead>
              <tbody>{insights.products.map((item) => (
                <tr key={`${item.productId ?? "snapshot"}-${item.productName}`}>
                  <td><strong>{item.productName}</strong></td><td>{item.orderCount}</td><td>{item.quantity}</td><td>{formatMoney(item.salesCents)}</td><td>{new Date(item.lastPurchasedAt).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      <p className={styles.note}>Recência e intervalo são indicadores determinísticos do histórico disponível; não representam previsão de comportamento.</p>
    </Section>
  );
}
