import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Sidebar } from "../../components/master/Sidebar";
import { Header } from "../../components/master/Header";

export const Route = createFileRoute("/master/__layout")({
  component: () => (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      <Sidebar />
      <div className="flex-1 lg:ml-[var(--sidebar-width)] min-h-screen">
        <Header />
        <main className="p-4 lg:p-6">
          <div className="max-w-[var(--content-max-width)] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  ),
});