import type { StorefrontAnalyticsSummary } from "../../lib/server/storefront-analytics.functions.ts";

function percent(value: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value) + "%";
}

export function StorefrontAnalyticsPanel({ analytics }: Readonly<{
  analytics: StorefrontAnalyticsSummary;
}>): React.JSX.Element {
  const metrics = [
    ["Visitas", analytics.visits, "sessões com visualização do catálogo"],
    ["Produtos vistos", analytics.productViews, "eventos de visualização de produto"],
    ["Adicionar ao carrinho", analytics.addToCart, "ações persistidas"],
    ["Checkouts iniciados", analytics.checkoutStarts, "sessões que iniciaram checkout"],
    ["Pedidos", analytics.orders, "pedidos storefront não cancelados"],
  ] as const;
  return (
    <section className="k-workspace-section">
      <header className="k-section-head">
        <div>
          <span className="k-section-kicker">Conversão · 30 dias</span>
          <h2>Analytics do catálogo</h2>
          <p>Eventos persistidos internamente; independentes de Meta, GA4 ou TikTok.</p>
        </div>
        <strong>{percent(analytics.conversionRate)} de conversão</strong>
      </header>
      <div className="k-dashboard-strip" aria-label="Analytics do catálogo">
        {metrics.map(([label, value, detail]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}
      </div>
    </section>
  );
}
