import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { ProductForm } from "../features/store-admin/product-form.tsx";
import { listMerchantCategories } from "../lib/server/catalog.functions.ts";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";

export const Route = createFileRoute("/admin/products/new")({loader: () => listMerchantCategories(),pendingComponent: AdminRoutePending,errorComponent: AdminRouteError,component: NewProductPage});
function NewProductPage(): React.JSX.Element {const categories=Route.useLoaderData();return <div className="k-page"><PageHead title="Adicionar produto" description="Comece pelo básico. Depois de salvar, você adiciona as fotos e gera cores, tamanhos e outras combinações automaticamente."/><div className="productCreationGuide"><div><b>1</b><span><strong>Informações</strong><small>Nome, preço e categoria</small></span></div><div><b>2</b><span><strong>Fotos</strong><small>Envie várias imagens</small></span></div><div><b>3</b><span><strong>Variações</strong><small>Gere tamanhos e cores</small></span></div><div><b>4</b><span><strong>Estoque</strong><small>Ajuste após criar as opções</small></span></div></div><ProductForm product={null} categories={categories}/></div>;}
