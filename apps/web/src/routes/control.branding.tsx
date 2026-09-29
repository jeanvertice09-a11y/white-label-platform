import { createFileRoute } from "@tanstack/react-router";
import { ControlBrandingPage } from "../features/control/control-branding-page.tsx";

export const Route = createFileRoute("/control/branding")({
  component: ControlBrandingRoute,
});

function ControlBrandingRoute(): React.JSX.Element {
  return <ControlBrandingPage />;
}
