import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { CatalogSettingsForm } from "../features/store-admin/catalog-settings-form.tsx";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";
export const Route=createFileRoute("/admin/store/appearance")({loader:()=>getMerchantCatalogOverview(),pendingComponent:()=> <EmptyState title="Carregando aparência" description="Buscando identidade visual da loja."/>,errorComponent:({error})=> <EmptyState title="Não foi possível carregar a aparência" description={error instanceof Error?error.message:"Tente novamente em instantes."}/>,component:AppearancePage});
function AppearancePage():React.JSX.Element{const data=Route.useLoaderData();return <><PageHeader title="Aparência da loja" description="Escolha o layout e personalize cores de forma estruturada e segura."/><CatalogSettingsForm settings={data.settings}/></>;}
