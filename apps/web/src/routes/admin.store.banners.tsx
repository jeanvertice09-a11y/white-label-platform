import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { BannerManager } from "../features/store-admin/banner-manager.tsx";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";

export const Route = createFileRoute("/admin/store/banners")({
  loader: () => getMerchantCatalogOverview(),
  component: BannersPage,
});

function BannersPage() {
  const data = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Banners"
        description="Gerencie os destaques visuais do catálogo da sua loja."
      />
      <BannerManager banners={data.banners} />
    </div>
  );
}
