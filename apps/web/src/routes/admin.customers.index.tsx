import { createFileRoute } from "@tanstack/react-router";
import { CustomerCreateForm } from "../features/store-admin/customer-create-form.tsx";
import { CustomersList } from "../features/store-admin/customers-list.tsx";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { listMerchantCustomers } from "../lib/server/operations-customers.functions.ts";

export const Route = createFileRoute("/admin/customers/")({
  loader: () => listMerchantCustomers({
    data: { page: 1, pageSize: 20 },
  }),
  pendingComponent: () => <div className="k-empty">Carregando clientes…</div>,
  errorComponent: ({ error }) => (
    <div className="k-empty">
      {error instanceof Error ? error.message : "Não foi possível carregar clientes."}
    </div>
  ),
  component: CustomersPage,
});

function CustomersPage(): React.JSX.Element {
  const page = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead
        title="Clientes"
        description="CRM real da loja com histórico e métricas derivadas dos pedidos."
      />
      <CustomerCreateForm />
      <CustomersList initialPage={page} />
    </div>
  );
}
