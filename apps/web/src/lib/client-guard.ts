// Client-safe: chama a server function do TanStack Start (RPC automático).
// A validação real vive em lib/server/route-context.server.ts (servidor).
import { getMasterContext, getControlContext, getStoreAdminContext } from "./server/context.functions.ts";

export class RouteContextError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function callServerFn(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof Response) {
      const status = err.status;
      let message = "Acesso negado";
      try {
        const body = (await err.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        // mantém mensagem padrão
      }
      throw new RouteContextError(status, message);
    }
    if (err instanceof Error) {
      throw new RouteContextError(403, err.message);
    }
    throw new RouteContextError(403, "Erro desconhecido");
  }
}

export function loadMasterContext(): Promise<void> {
  return callServerFn(getMasterContext);
}

export function loadControlContext(): Promise<void> {
  return callServerFn(getControlContext);
}

export function loadStoreAdminContext(): Promise<void> {
  return callServerFn(getStoreAdminContext);
}