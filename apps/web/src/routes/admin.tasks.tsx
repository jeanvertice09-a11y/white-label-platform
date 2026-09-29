import { createFileRoute } from "@tanstack/react-router";
import type { MerchantTask } from "../../../../packages/merchant-ops/src/types.ts";
import { PageHead } from "../features/store-admin/admin-shell.tsx";
import { AdminFeatureUnavailable, AdminRouteError, AdminRoutePending } from "../features/store-admin/admin-route-state.tsx";
import { MerchantTasksManager } from "../features/store-admin/merchant-tasks-manager.tsx";
import {
  getMerchantOperationsAccess,
  listMerchantTaskAssignees,
  listMerchantTasks,
} from "../lib/server/operations-merchant.functions.ts";
import type { MerchantTaskAssigneeOption } from "../lib/server/operations-merchant.functions.ts";

interface TasksLoaderData {
  enabled: boolean;
  tasks: MerchantTask[];
  assignees: MerchantTaskAssigneeOption[];
}

export const Route = createFileRoute("/admin/tasks")({
  loader: async (): Promise<TasksLoaderData> => {
    const access = await getMerchantOperationsAccess();
    if (!access.tasks) return { enabled: false, tasks: [], assignees: [] };
    const [tasks, assignees] = await Promise.all([listMerchantTasks(), listMerchantTaskAssignees()]);
    return { enabled: true, tasks, assignees };
  },
  pendingComponent: AdminRoutePending,
  errorComponent: AdminRouteError,
  component: TasksPage,
});

function TasksPage(): React.JSX.Element {
  const data = Route.useLoaderData();
  return <div className="k-page">
    <PageHead title="Tarefas" description="Organize pendências operacionais, responsáveis, prioridades e prazos da loja." />
    {data.enabled
      ? <MerchantTasksManager initial={data.tasks} assignees={data.assignees} />
      : <AdminFeatureUnavailable title="Tarefas indisponíveis" description="Este recurso não está disponível para a loja atual." />}
  </div>;
}
