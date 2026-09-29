import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { Section } from "../admin/ui/Section.tsx";
import { BulkImportPanel } from "../features/store-admin/bulk-import-panel.tsx";
import { ProductsList } from "../features/store-admin/products-list.tsx";
import { listMerchantCategories, listMerchantProducts } from "../lib/server/catalog.functions.ts";
async function loadProductsPage() { const [categories, products] = await Promise.all([listMerchantCategories(), listMerchantProducts({ data: { page: 1, pageSize: 20, sort: "position" } })]); return { categories, products }; }
export const Route = createFileRoute("/admin/products/")({ loader: loadProductsPage, pendingComponent: () => <EmptyState title="Carregando produtos" description="Buscando os produtos da sua vitrine." />, errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar os produtos" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />, component: ProductsPage });
function ProductsPage(): React.JSX.Element { const data = Route.useLoaderData(); return <><PageHeader title="Produtos" description="Cadastre e mantenha sua vitrine. Fotos, preços e variações ficam dentro de cada produto." action={<Link className="k-button k-button--primary" to="/admin/products/new">Adicionar produto</Link>} /><ProductsList initialPage={data.products} categories={data.categories} /><Section title="Importar vários produtos" description="Opção avançada para quem já possui uma lista pronta."><BulkImportPanel /></Section></>; }
