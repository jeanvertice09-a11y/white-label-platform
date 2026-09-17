// Client-safe: chama o endpoint de contexto da rota (mesma origem).
// Sem servidor Start/API por trás, o fetch falha -> NEGA (fail closed).
// A validação real vive em lib/server/route-context.ts (servidor).
export class RouteContextError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function fetchContext(route: "master" | "control" | "store-admin"): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/context/${route}`, { credentials: "same-origin" });
  } catch {
    throw new RouteContextError(403, "Servidor de contexto indisponível");
  }
  if (!res.ok) {
    let message = "Acesso negado";
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // corpo ilegível: mantém mensagem padrão
    }
    throw new RouteContextError(res.status, message);
  }
}

export function loadMasterContext(): Promise<void> {
  return fetchContext("master");
}

export function loadControlContext(): Promise<void> {
  return fetchContext("control");
}

export function loadStoreAdminContext(): Promise<void> {
  return fetchContext("store-admin");
}
