import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/products")({
  component: ProductsLayout,
});

function ProductsLayout(): React.JSX.Element {
  return <Outlet />;
}
