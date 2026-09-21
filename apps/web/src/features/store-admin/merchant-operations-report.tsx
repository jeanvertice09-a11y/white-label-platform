import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { MerchantOperationsReport } from "../../../../../packages/merchant-ops/src/types.ts";
import { getMerchantOperationsReport } from "../../lib/server/operations-dashboard.functions.ts";
import { formatMoney } from "./format.ts";
import { messageFrom } from "./merchant-operations-utils.ts";

function Metric(props: Readonly<{ label: string; value: string | number; detail?: string }>): React.JSX.Element {
  return <div><span>{props.label}</span><strong>{props.value}</strong>{props.detail ? <small>{props.detail}</small> : null}</div>;
}

function ReportGrid({ report }: Readonly<{ report: MerchantOperationsReport }>): React.JSX.Element {
  return <div className="k-dashboard-strip" aria-label="Indicadores operacionais do período">
    <Metric label="Pedidos concluídos" value={report.completedOrders} />
    <Metric label="Vendas" value={formatMoney(report.salesCents)} />
    <Metric label="Compradores" value={report.buyers} detail={`${report.customers} cliente(s) cadastrados`} />
    <Metric label="Produtos ativos" value={report.activeProducts} detail={`${report.lowStockProducts} com estoque baixo`} />
    <Metric label="Compras recebidas" value={report.receivedPurchases} detail={formatMoney(report.receivedPurchasesTotalCents)} />
    <Metric label="Fornecedores" value={report.suppliers} detail={`${report.activeSuppliers} ativos`} />
    <Metric label="Tarefas abertas" value={report.openTasks} detail={`${report.completedTasks} concluídas no período`} />
    <Metric label="Fluxo de caixa" value={formatMoney(report.finance.cashFlowCents)} detail={`${formatMoney(report.finance.receivedCents)} recebido · ${formatMoney(report.finance.paidCents)} pago`} />
  </div>;
}

export function MerchantOperationsReportView({ initial }: Readonly<{ initial: MerchantOperationsReport }>): React.JSX.Element {
  const [report, setReport] = useState(initial);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setLoading(true); setError("");
    try { setReport(await getMerchantOperationsReport({ data: { from, to } })); }
    catch (cause) { setError(messageFrom(cause, "Não foi possível atualizar o relatório operacional.")); }
    finally { setLoading(false); }
  }

  return <div className="k-stack">
    <section className="k-workspace-section">
      <div className="k-section-head"><div><h2>Período do relatório</h2><p>Os indicadores usam somente dados reais da loja autenticada.</p></div></div>
      <form className="k-toolbar" onSubmit={(event) => { void submit(event); }}>
        <label className="k-field"><span>De</span><input type="date" required value={from} onChange={(event) => { setFrom(event.target.value); }} /></label>
        <label className="k-field"><span>Até</span><input type="date" required value={to} onChange={(event) => { setTo(event.target.value); }} /></label>
        <button className="k-button k-button--primary" type="submit" disabled={loading}>{loading ? "Atualizando…" : "Aplicar período"}</button>
      </form>
      {error ? <div className="k-inline-state k-inline-state--error"><strong>Erro</strong><span>{error}</span></div> : null}
    </section>
    <ReportGrid report={report} />
    <section className="k-workspace-section">
      <div className="k-section-head"><div><h2>Financeiro</h2><p>Resumo reaproveitado do financeiro existente, sem criar uma segunda fonte de dados.</p></div></div>
      <div className="k-dashboard-strip">
        <Metric label="Recebido" value={formatMoney(report.finance.receivedCents)} />
        <Metric label="Pago" value={formatMoney(report.finance.paidCents)} />
        <Metric label="Fluxo de caixa" value={formatMoney(report.finance.cashFlowCents)} />
        <Metric label="Receita por competência" value={formatMoney(report.finance.competenceReceivableCents)} />
        <Metric label="Despesa por competência" value={formatMoney(report.finance.competencePayableCents)} />
        <Metric label="Resultado gerencial" value={formatMoney(report.finance.managerialResultCents)} />
      </div>
    </section>
  </div>;
}
