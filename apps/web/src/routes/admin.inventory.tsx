import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/inventory")({
  beforeLoad: () => { redirect({ to: "/admin/products", replace: true, throw: true }); },
});
