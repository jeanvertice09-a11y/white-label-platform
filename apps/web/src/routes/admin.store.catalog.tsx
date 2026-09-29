import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { CatalogSettingsForm } from "../features/store-admin/catalog-settings-form.tsx";
import { getMerchantCatalogOverview } from "../lib/server/catalog.functions.ts";
export const Route=createFileRoute("/admin/store/catalog")({loader:()=>getMerchantCatalogOverview(),pendingComponent:()=> <EmptyState title="Carregando catálogo" description="Buscando configurações de venda e publicação."/>,errorComponent:({error})=> <EmptyState title="Não foi possível carregar o catálogo" description={error instanceof Error?error.message:"Tente novamente em instantes."}/>,component:CatalogSettingsPage});
function CatalogSettingsPage():React.JSX.Element{const data=Route.useLoaderData();return <><PageHeader title="Configurar minha loja" description="Deixe seu catálogo pronto para vender. São poucos passos e você pode alterar tudo depois."/><CatalogSettingsForm settings={data.settings}/></>;}
