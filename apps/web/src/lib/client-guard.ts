// Client-safe: chama a server function do TanStack Start (RPC automático).
// A validação real vive em lib/server/route-context.server.ts (servidor).
import { redirect } from "@tanstack/react-router";
import { getMasterContext, getControlContext, getStoreAdminContext } from "./server/context.functions.ts";

export class RouteContextError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function readErrorStatus(err: unknown): number | null {
  if (err instanceof Response) return err.status;
  if (typeof err !== "object" || err === null || !("status" in err)) return null;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function readErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Acesso negado";
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : "Acesso negado";
  } catch {
    return "Acesso negado";
  }
}

async function normalizeRouteError(err: unknown): Promise<never> {
  const status = readErrorStatus(err);
  if (status === 401) {
    redirect({ to: "/login", replace: true, throw: true });
  }
  if (err instanceof Response) {
    throw new RouteContextError(status ?? 403, await responseMessage(err));
  }
  throw new RouteContextError(status ?? 403, readErrorMessage(err));
}

async function callServerFn(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    return normalizeRouteError(err);
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
