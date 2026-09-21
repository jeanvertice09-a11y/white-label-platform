import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";

export const Route = createFileRoute("/admin/operations")({
  component: OperationsRoutePage,
});

function OperationsRoutePage(): React.JSX.Element {
  return <div className="k-page">
    <PageHead
      title="Gestão da loja"
      description="Acesse cada área operacional em uma página própria do painel."
    />
    <section className="k-workspace-section">
      <div className="k-section-head">
        <div>
          <h2>Áreas operacionais</h2>
          <p>Use as rotas dedicadas para financeiro, compras, fornecedores e tarefas.</p>
        </div>
      </div>
      <div className="k-actions">
        <Link className="k-button" to="/admin/finance">Visão financeira</Link>
        <Link className="k-button" to="/admin/purchases">Compras</Link>
        <Link className="k-button" to="/admin/suppliers">Fornecedores</Link>
        <Link className="k-button" to="/admin/tasks">Tarefas</Link>
      </div>
    </section>
  </div>;
}
