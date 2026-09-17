// RPC boundary: server functions exportadas p/ client via TanStack Start.
// Este arquivo usa createServerFn e importa lógica pura de *.server.ts.
// Pode ser importado pelo client (não é .server.ts).
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { loadControl, loadMaster, loadStoreAdmin, createRealDeps } from "./route-context.server.ts";
import type { RouteDeps } from "./route-context.server.ts";

function requestInput(): { host: string | null } {
  return {
    host: getRequestHost(),
  };
}

let realDepsPromise: Promise<RouteDeps> | null = null;

async function getRealDeps(): Promise<RouteDeps> {
  if (!realDepsPromise) {
    realDepsPromise = createRealDeps();
  }
  return realDepsPromise;
}

/** Server functions: executam no servidor; client recebe apenas stub RPC. */
export const getMasterContext = createServerFn({ method: "GET" }).handler(async () => {
  const deps = await getRealDeps();
  return loadMaster(requestInput(), deps);
});

export const getControlContext = createServerFn({ method: "GET" }).handler(async () => {
  const deps = await getRealDeps();
  return loadControl(requestInput(), deps);
});

export const getStoreAdminContext = createServerFn({ method: "GET" }).handler(async () => {
  const deps = await getRealDeps();
  return loadStoreAdmin(requestInput(), deps);
});