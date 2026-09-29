import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ConsoleRouteError, ConsoleRoutePending } from "../components/console/ConsoleRouteState.tsx";
import { ControlMerchantsManager } from "../features/control/control-merchants-manager.tsx";
import { getControlMerchantWorkspace } from "../lib/server/control-merchants.functions.ts";

export const Route = createFileRoute("/control/stores")({
  loader: () => getControlMerchantWorkspace(),
  pendingComponent: ConsoleRoutePending,
  errorComponent: ConsoleRouteError,
  component: ControlStoresRoute,
});

function ControlStoresRoute(): React.JSX.Element {
  const navigate = useNavigate();
  return <ControlMerchantsManager
    initial={Route.useLoaderData()}
    onOpenStore={(storeId) => { void navigate({ to: "/control/stores/$storeId", params: { storeId } }); }}
  />;
}
