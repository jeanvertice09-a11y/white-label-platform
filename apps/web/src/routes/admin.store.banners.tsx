import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { BannerManager } from "../features/store-admin/banner-manager.tsx";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";
export const Route=createFileRoute("/admin/store/banners")({loader:()=>getMerchantCatalogOverview(),pendingComponent:()=> <EmptyState title="Carregando banners" description="Buscando os destaques visuais da loja."/>,errorComponent:({error})=> <EmptyState title="Não foi possível carregar os banners" description={error instanceof Error?error.message:"Tente novamente em instantes."}/>,component:BannersPage});
function BannersPage():React.JSX.Element{const data=Route.useLoaderData();return <><PageHeader title="Banners" description="Gerencie os destaques visuais do catálogo da sua loja."/><BannerManager banners={data.banners}/></>;}
