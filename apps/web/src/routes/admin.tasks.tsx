import { createFileRoute } from "@tanstack/react-router";
import type { MerchantTask } from "../../../../packages/merchant-ops/src/types.ts";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { AdminFeatureUnavailable, AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { MerchantTasksManager } from "../features/store-admin/merchant-tasks-manager.tsx";
import { getMerchantOperationsAccess, listMerchantTasks } from "../lib/server/operations-merchant.functions.ts";

interface TasksLoaderData {
  enabled: boolean;
  tasks: MerchantTask[];
}

export const Route = createFileRoute("/admin/tasks")({
  loader: async (): Promise<TasksLoaderData> => {
    const access = await getMerchantOperationsAccess();
    const tasks = access.tasks ? await listMerchantTasks() : [];
    return { enabled: access.tasks, tasks };
  },
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: TasksPage,
});

function TasksPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <div className="k-page">
    <PageHead title="Tarefas" description="Organize pendências operacionais simples e acompanhe o que ainda precisa ser concluído." />
    {data.enabled
      ? <MerchantTasksManager initial={data.tasks} />
      : <AdminFeatureUnavailable title="Tarefas indisponíveis" description="Este recurso não está disponível para a loja atual." />}
  </div>;
}
