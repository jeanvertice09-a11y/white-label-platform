import { createRootRoute, Outlet } from "@tanstack/react-router";
import "../styles/global.css";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
    </>
  ),
});