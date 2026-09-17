import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHost } from "@tanstack/react-start/server";
import { loadControl, loadMaster, loadStoreAdmin } from "./route-context.ts";

function requestInput(): { cookieHeader: string | null; host: string | null } {
  const req = getRequest();
  return {
    cookieHeader: req.headers.get("cookie"),
    host: getRequestHost(),
  };
}

/** Server functions: executam no servidor; client recebe apenas stub RPC. */
export const getMasterContext = createServerFn({ method: "GET" }).handler(async () => {
  return loadMaster(requestInput());
});

export const getControlContext = createServerFn({ method: "GET" }).handler(async () => {
  return loadControl(requestInput());
});

export const getStoreAdminContext = createServerFn({ method: "GET" }).handler(async () => {
  return loadStoreAdmin(requestInput());
});
