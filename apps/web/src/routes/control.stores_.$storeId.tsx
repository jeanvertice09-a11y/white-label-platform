import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { ControlMerchantDetailPanel } from "../features/control/control-merchant-detail.tsx";
import { getControlMerchant, getControlMerchantWorkspace } from "../lib/server/control-merchants.functions.ts";

export const Route = createFileRoute("/control/stores_/$storeId")({
  loader: async ({ params: { storeId } }) => {
    const [detail, workspace] = await Promise.all([
      getControlMerchant({ data: { storeId } }),
      getControlMerchantWorkspace(),
    ]);
    if (!detail) throw Object.assign(new Error("Loja não encontrada nesta White Label."), { status: 404 });
    return { detail, plans: workspace.plans };
  },
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: ControlStoreDetailRoute,
});

function ControlStoreDetailRoute(): React.JSX.Element {
  const data = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  return <ControlMerchantDetailPanel
    detail={data.detail}
    plans={data.plans}
    onChanged={async () => { await router.invalidate(); }}
    onClose={() => { void navigate({ to: "/control/stores" }); }}
  />;
}
