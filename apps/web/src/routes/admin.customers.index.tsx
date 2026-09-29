import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../admin/ui/EmptyState.tsx";
import { PageHeader } from "../admin/ui/PageHeader.tsx";
import { CustomersList } from "../features/store-admin/customers-list.tsx";
import { listMerchantCustomers } from "../lib/server/operations-customers.functions.ts";

export const Route = createFileRoute("/admin/customers/")({
  loader: () => listMerchantCustomers({ data: { page: 1, pageSize: 20 } }),
  pendingComponent: () => <EmptyState title="Carregando clientes" description="Buscando o CRM e o histórico da loja." />,
  errorComponent: ({ error }) => <EmptyState title="Não foi possível carregar os clientes" description={error instanceof Error ? error.message : "Tente novamente em instantes."} />,
  component: CustomersPage,
});

function CustomersPage(): React.JSX.Element {
  const page = Route.useLoaderData();
  return <><PageHeader title="Clientes" description="CRM real da loja com histórico e métricas derivadas dos pedidos." /><CustomersList initialPage={page} /></>;
}
