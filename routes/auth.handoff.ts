import { createFileRoute } from "@tanstack/react-router";
import { handleAdminSessionHandoff } from "../lib/server/admin-session-handoff.server.ts";

export const Route = createFileRoute("/auth/handoff")({
  server: { handlers: { POST: ({ request }) => handleAdminSessionHandoff(request) } },
});
