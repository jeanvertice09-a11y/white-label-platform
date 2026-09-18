import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function MasterShell() {
  return (
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
  );
}