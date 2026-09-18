import { createFileRoute } from "@tanstack/react-router";
import { CustomerCreateForm } from "../features/store-admin/customer-create-form.tsx";
import { CustomersList } from "../features/store-admin/customers-list.tsx";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { listMerchantCustomers } from "../lib/server/operations-customers.functions.ts";

export const Route = createFileRoute("/admin/customers/")({
  loader: () => listMerchantCustomers({ data: { search: "" } }),
  component: CustomersPage,
});

function CustomersPage(): React.JSX.Element {
  const customers = Route.useLoaderData();
  return (
    <div className="k-page">
      <PageHead title="Clientes" description="CRM básico com busca, contato e histórico de compras." />
      <CustomerCreateForm />
      <CustomersList customers={customers} />
    </div>
  );
}
