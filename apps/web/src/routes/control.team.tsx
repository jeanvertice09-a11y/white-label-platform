import { createFileRoute } from "@tanstack/react-router";
import { ControlTeamPage } from "../features/control/control-team-page.tsx";
import { getControlTeamWorkspace } from "../lib/server/control-team.functions.ts";

export const Route = createFileRoute("/control/team")({
  loader: () => getControlTeamWorkspace(),
  component: ControlTeamRoute,
});

function ControlTeamRoute(): React.JSX.Element {
  return <ControlTeamPage initial={Route.useLoaderData()} />;
}
