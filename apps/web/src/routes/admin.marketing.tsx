import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";

export const Route = createFileRoute("/admin/marketing")({
  component: MarketingRoutePage,
});

function MarketingRoutePage(): React.JSX.Element {
  return <div className="k-page">
    <PageHead
      title="Marketing"
      description="Acesse cupons e campanhas em páginas próprias do painel."
    />
    <section className="k-workspace-section">
      <div className="k-section-head">
        <div>
          <h2>Ferramentas de marketing</h2>
          <p>Gerencie promoções e comunicação sem depender de âncoras na URL.</p>
        </div>
      </div>
      <div className="k-actions">
        <Link className="k-button" to="/admin/coupons">Cupons</Link>
        <Link className="k-button" to="/admin/campaigns">Campanhas</Link>
      </div>
    </section>
  </div>;
}
