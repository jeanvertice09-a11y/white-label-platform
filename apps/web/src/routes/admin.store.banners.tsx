import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { BannerManager } from "../features/store-admin/banner-manager.tsx";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/store/banners")({
  loader: () => getMerchantCatalogOverview(),
  component: BannersPage,
});

function BannersPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <><PageHeader title="Banners" description="Gerencie os destaques visuais do catálogo da sua loja." /><BannerManager banners={data.banners} /></>;
}
