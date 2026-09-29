import { createFileRoute } from "@tanstack/react-router";
import { CustomersList } from "../features/store-admin/customers-list.tsx";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { listMerchantCustomers } from "../lib/server/operations-customers.functions.ts";
export const Route=createFileRoute("/admin/customers/")({loader:()=>listMerchantCustomers({data:{page:1,pageSize:20}}),pendingComponent:AdminRoutePending,errorComponent:AdminRouteError,component:CustomersPage});
function CustomersPage():React.JSX.Element{const page=Route.useLoaderData();return <div className="k-page"><PageHead title="Clientes" description="CRM real da loja com histórico e métricas derivadas dos pedidos."/><CustomersList initialPage={page}/></div>}
