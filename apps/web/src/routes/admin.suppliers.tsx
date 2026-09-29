import { createFileRoute } from "@tanstack/react-router";
import type { Page, Supplier } from "../../../../packages/merchant-ops/src/types.ts";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { MerchantSuppliersManager } from "../features/store-admin/merchant-suppliers-manager.tsx";
import { getMerchantOperationsAccess, listMerchantSuppliers } from "../lib/server/operations-merchant.functions.ts";

interface SuppliersLoaderData { enabled: boolean; suppliers: Page<Supplier> }
function emptyPage(): Page<Supplier> { return { items: [], page: 1, pageSize: 25, total: 0 }; }

export const Route = createFileRoute("/admin/suppliers")({
  loader: async (): Promise<SuppliersLoaderData> => {
    const access = await getMerchantOperationsAccess();
    const suppliers = access.suppliers ? await listMerchantSuppliers({ data: { page: 1, pageSize: 25 } }) : emptyPage();
    return { enabled: access.suppliers, suppliers };
  },
  pendingComponent: () => <EmptyState title="Carregando fornecedores" description="Buscando os fornecedores da loja." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar os fornecedores" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: SuppliersPage,
});

function SuppliersPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <><PageHeader title="Fornecedores" description="Cadastre e consulte fornecedores usados nas compras e contas da loja." />{data.enabled ? <MerchantSuppliersManager initial={data.suppliers} /> : <EmptyState title="Fornecedores indisponíveis" description="Este recurso não está habilitado para o plano atual da loja." />}</>;
}
