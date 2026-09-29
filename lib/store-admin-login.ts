import type { Session } from "@supabase/supabase-js";
import { getBrowserClient } from "./supabase-client.ts";

export async function redirectToStoreAdmin(session: Session): Promise<void> {
  const client = getBrowserClient();
  const rpcResult: unknown = await client.rpc("resolve_my_store_admin_destination", {
    p_hostname: window.location.hostname,
  });
  if (typeof rpcResult !== "object" || rpcResult === null) {
    throw new Error("Não foi possível validar o acesso à loja. Tente novamente.");
  }
  const result = rpcResult as { data?: unknown; error?: unknown };
  if (result.error) throw new Error("Não foi possível validar o acesso à loja. Tente novamente.");
  const hostname = result.data;
  if (typeof hostname !== "string" || hostname.length === 0) {
    await client.auth.signOut();
    throw new Error("Este usuário não possui acesso a uma loja disponível.");
  }
  const target = new URL("/admin", window.location.origin);
  target.hostname = hostname;
  if (target.origin === window.location.origin) {
    window.location.assign(target.toString());
    return;
  }
  if (target.protocol !== "https:") throw new Error("Domínio da loja sem conexão segura.");
  const handoff = document.createElement("form");
  handoff.method = "POST";
  handoff.action = new URL("/auth/handoff", target).toString();
  for (const [name, value] of Object.entries({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })) {
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = name;
    field.value = value;
    handoff.append(field);
  }
  document.body.append(handoff);
  handoff.submit();
}
