import { createFileRoute } from "@tanstack/react-router";
import type { Page, Supplier } from "../../../../packages/merchant-ops/src/types.ts";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { AdminFeatureUnavailable, AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { MerchantSuppliersManager } from "../features/store-admin/merchant-suppliers-manager.tsx";
import { getMerchantOperationsAccess, listMerchantSuppliers } from "../lib/server/operations-merchant.functions.ts";

interface SuppliersLoaderData {
  enabled: boolean;
  suppliers: Page<Supplier>;
}

function emptyPage(): Page<Supplier> {
  return { items: [], page: 1, pageSize: 25, total: 0 };
}

export const Route = createFileRoute("/admin/suppliers")({
  loader: async (): Promise<SuppliersLoaderData> => {
    const access = await getMerchantOperationsAccess();
    const suppliers = access.suppliers
      ? await listMerchantSuppliers({ data: { page: 1, pageSize: 25 } })
      : emptyPage();
    return { enabled: access.suppliers, suppliers };
  },
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: SuppliersPage,
});

function SuppliersPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <div className="k-page">
    <PageHead title="Fornecedores" description="Cadastre e consulte fornecedores usados nas compras e contas da loja." />
    {data.enabled
      ? <MerchantSuppliersManager initial={data.suppliers} />
      : <AdminFeatureUnavailable title="Fornecedores indisponíveis" description="Este recurso não está habilitado para o plano atual da loja." />}
  </div>;
}
