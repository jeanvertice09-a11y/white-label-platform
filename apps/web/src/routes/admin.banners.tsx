import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { BannerManager } from "../features/store-admin/banner-manager.tsx";
import { listMerchantBanners } from "../lib/server/catalog-merchandising.functions.ts";

export const Route = createFileRoute("/admin/banners")({
  loader: () => listMerchantBanners(),
  pendingComponent: () => <EmptyState title="Carregando banners" description="Buscando os destaques da sua vitrine." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar os banners" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: BannersPage,
});

function BannersPage(): React.JSX.Element {
  const banners = Route.useLoaderData();
  return <><PageHeader title="Banners" description="Organize os destaques visuais exibidos no catálogo público." /><BannerManager banners={banners} /></>;
}
