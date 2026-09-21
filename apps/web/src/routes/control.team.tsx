import { createFileRoute } from "@tanstack/react-router";
import { ControlTeamPage } from "../features/control/control-team-page.tsx";

export const Route = createFileRoute("/control/team")({
  component: ControlTeamRoute,
});

function ControlTeamRoute(): React.JSX.Element {
  return <ControlTeamPage />;
}
