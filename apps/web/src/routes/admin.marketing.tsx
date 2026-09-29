import { Link, createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { Section } from "../admin/ui/Section.tsx";

export const Route = createFileRoute("/admin/marketing")({
  pendingComponent: () => <EmptyState title="Carregando marketing" description="Preparando as ferramentas de marketing." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar o marketing" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: MarketingRoutePage,
});

function MarketingRoutePage(): React.JSX.Element {
  return <><PageHeader title="Marketing" description="Acesse cupons e campanhas em páginas próprias do painel." /><Section title="Ferramentas de marketing" description="Gerencie promoções e comunicação em áreas dedicadas."><nav aria-label="Ferramentas de marketing"><Link to="/admin/coupons">Cupons</Link>{" · "}<Link to="/admin/campaigns">Campanhas</Link></nav></Section></>;
}
