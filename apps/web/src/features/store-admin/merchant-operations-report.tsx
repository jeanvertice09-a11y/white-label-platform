import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import type {
  MerchantOperationalReport,
  MerchantFinanceCategoryPerformance,
} from "../../lib/server/merchant-reporting.functions.ts";
import { getMerchantOperationalReport } from "../../lib/server/merchant-reporting.functions.ts";
import { formatMoney } from "./format.ts";
import { messageFrom } from "./merchant-operations-utils.ts";

function Metric(props: Readonly<{ label: string; value: string | number; detail?: string }>): React.JSX.Element {
  return <div><span>{props.label}</span><strong>{props.value}</strong>{props.detail ? <small>{props.detail}</small> : null}</div>;
}

function ReportGrid({ report }: Readonly<{ report: MerchantOperationalReport }>): React.JSX.Element {
  return <div className="k-dashboard-strip" aria-label="Indicadores operacionais do período">
    <Metric label="Pedidos concluídos" value={report.completedOrders} />
    <Metric label="Faturamento" value={formatMoney(report.salesCents)} />
    <Metric label="Ticket médio" value={formatMoney(report.averageTicketCents)} />
    <Metric label="Compradores" value={report.buyers} detail={`${String(report.customers)} cliente(s) cadastrados`} />
    <Metric label="Cadastros no período" value={report.newCustomers} />
    <Metric label="Produtos ativos" value={report.activeProducts} detail={`${String(report.lowStockProducts)} com estoque baixo`} />
    <Metric label="Compras recebidas" value={report.receivedPurchases} detail={formatMoney(report.receivedPurchasesTotalCents)} />
    <Metric label="Fluxo de caixa" value={formatMoney(report.finance.cashFlowCents)} detail={`${formatMoney(report.finance.receivedCents)} recebido · ${formatMoney(report.finance.paidCents)} pago`} />
  </div>;
}

function ProductPerformance({ report }: Readonly<{ report: MerchantOperationalReport }>): React.JSX.Element {
  return <section className="k-workspace-section">
    <div className="k-section-head"><div><h2>Desempenho por produto</h2><p>Quantidade e valor dos itens em pedidos concluídos no período. Margem não é exibida sem custo histórico confiável por venda.</p></div></div>
    {!report.topProducts.length ? <div className="k-inline-state">Nenhum produto vendido no período.</div> : <div className="k-table-wrap k-table-wrap--flush"><table className="k-table"><thead><tr><th>Produto</th><th>Pedidos</th><th>Quantidade</th><th className="k-align-right">Vendas dos itens</th></tr></thead><tbody>{report.topProducts.map((item) => <tr key={`${item.productId ?? "snapshot"}-${item.productName}`}><td><strong>{item.productName}</strong></td><td>{item.orderCount}</td><td>{item.quantitySold}</td><td className="k-align-right k-money">{formatMoney(item.salesCents)}</td></tr>)}</tbody></table></div>}
  </section>;
}

function CustomerPerformance({ report }: Readonly<{ report: MerchantOperationalReport }>): React.JSX.Element {
  return <section className="k-workspace-section">
    <div className="k-section-head"><div><h2>Desempenho por cliente</h2><p>Clientes com pedidos concluídos no período, ordenados pelo valor acumulado.</p></div></div>
    {!report.topCustomers.length ? <div className="k-inline-state">Nenhum cliente com compra concluída no período.</div> : <div className="k-table-wrap k-table-wrap--flush"><table className="k-table"><thead><tr><th>Cliente</th><th>Pedidos</th><th className="k-align-right">Total comprado</th><th>Última compra</th></tr></thead><tbody>{report.topCustomers.map((item) => <tr key={item.customerId}><td><Link className="k-text-action" to="/admin/customers/$id" params={{ id: item.customerId }}>{item.customerName}</Link></td><td>{item.orderCount}</td><td className="k-align-right k-money">{formatMoney(item.salesCents)}</td><td>{new Date(item.lastPurchaseAt).toLocaleDateString("pt-BR")}</td></tr>)}</tbody></table></div>}
  </section>;
}

function directionLabel(direction: MerchantFinanceCategoryPerformance["direction"]): string {
  return direction === "receivable" ? "Receita" : "Despesa";
}

function FinanceReport({ report }: Readonly<{ report: MerchantOperationalReport }>): React.JSX.Element {
  return <section className="k-workspace-section">
    <div className="k-section-head"><div><h2>Financeiro e resultado gerencial</h2><p>Reutiliza os lançamentos financeiros existentes. Resultado por competência não é DRE contábil oficial.</p></div></div>
    <div className="k-dashboard-strip">
      <Metric label="Recebido" value={formatMoney(report.finance.receivedCents)} />
      <Metric label="Pago" value={formatMoney(report.finance.paidCents)} />
      <Metric label="Fluxo de caixa" value={formatMoney(report.finance.cashFlowCents)} />
      <Metric label="Receita por competência" value={formatMoney(report.finance.competenceReceivableCents)} />
      <Metric label="Despesa por competência" value={formatMoney(report.finance.competencePayableCents)} />
      <Metric label="Resultado gerencial" value={formatMoney(report.finance.managerialResultCents)} />
    </div>
    {!report.financeByCategory.length ? <div className="k-inline-state">Nenhum lançamento financeiro por competência no período.</div> : <div className="k-table-wrap k-table-wrap--flush"><table className="k-table"><thead><tr><th>Categoria</th><th>Natureza</th><th>Lançamentos</th><th className="k-align-right">Valor por competência</th></tr></thead><tbody>{report.financeByCategory.map((item) => <tr key={`${item.direction}-${item.categoryId ?? "none"}`}><td>{item.categoryName}</td><td>{directionLabel(item.direction)}</td><td>{item.entryCount}</td><td className="k-align-right k-money">{formatMoney(item.amountCents)}</td></tr>)}</tbody></table></div>}
  </section>;
}

export function MerchantOperationsReportView({ initial }: Readonly<{ initial: MerchantOperationalReport }>): React.JSX.Element {
  const [report, setReport] = useState(initial);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setLoading(true); setError("");
    try { setReport(await getMerchantOperationalReport({ data: { from, to } })); }
    catch (cause) { setError(messageFrom(cause, "Não foi possível atualizar o relatório operacional.")); }
    finally { setLoading(false); }
  }

  return <div className="k-stack">
    <section className="k-workspace-section">
      <div className="k-section-head"><div><h2>Período do relatório</h2><p>Indicadores calculados no servidor e limitados à loja autenticada.</p></div></div>
      <form className="k-toolbar" onSubmit={(event) => { void submit(event); }}>
        <label className="k-field"><span>De</span><input type="date" required value={from} onChange={(event) => { setFrom(event.target.value); }} /></label>
        <label className="k-field"><span>Até</span><input type="date" required value={to} onChange={(event) => { setTo(event.target.value); }} /></label>
        <button className="k-button k-button--primary" type="submit" disabled={loading}>{loading ? "Atualizando…" : "Aplicar período"}</button>
      </form>
      {error ? <div className="k-inline-state k-inline-state--error"><strong>Erro</strong><span>{error}</span></div> : null}
    </section>
    <ReportGrid report={report} />
    <ProductPerformance report={report} />
    <CustomerPerformance report={report} />
    <FinanceReport report={report} />
  </div>;
}
