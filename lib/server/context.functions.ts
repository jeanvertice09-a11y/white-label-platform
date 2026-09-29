// RPC boundary: server functions exportadas para uso isomórfico via TanStack Start.
// Todo código server-only fica referenciado diretamente dentro dos handlers,
// permitindo que o compilador remova essas dependências do bundle do navegador.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import {
  createRealDeps,
  createStoreAdminRequestDeps,
  loadControl,
  loadMaster,
  loadStoreAdmin,
} from "./route-context.server.ts";

export const getMasterContext = createServerFn({ method: "GET" }).handler(async () => {
  const deps = await createRealDeps();
  return loadMaster({ host: getRequestHost() }, deps);
});

export const getControlContext = createServerFn({ method: "GET" }).handler(async () => {
  const deps = await createRealDeps();
  return loadControl({ host: getRequestHost() }, deps);
});

export const getStoreAdminContext = createServerFn({ method: "GET" }).handler(async () => {
  const deps = await createStoreAdminRequestDeps();
  return loadStoreAdmin({ host: getRequestHost() }, deps);
});
