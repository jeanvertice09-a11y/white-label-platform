// SERVER-ONLY: receives credentials only in an HTTPS POST body, never in a URL.
import { createRequestSupabaseClient } from "./supabase-server.server.ts";

export async function handleAdminSessionHandoff(
  request: Request,
  createClient: typeof createRequestSupabaseClient = createRequestSupabaseClient,
): Promise<Response> {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  const url = new URL(request.url);
  const originHeader = request.headers.get("origin");
  let source: URL;
  try { source = new URL(originHeader ?? ""); } catch { return new Response(null, { status: 403, headers }); }
  if (source.protocol !== "https:" || source.username || source.password || source.pathname !== "/") {
    return new Response(null, { status: 403, headers });
  }
  if (url.protocol !== "https:" || request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded") {
    return new Response(null, { status: 400, headers });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8192) return new Response(null, { status: 413, headers });
  const body = await request.text();
  if (body.length > 8192) return new Response(null, { status: 413, headers });
  const params = new URLSearchParams(body);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return new Response(null, { status: 400, headers });

  const client = createClient();
  try {
    const sessionResult: unknown = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (!sessionResult || typeof sessionResult !== "object") return new Response(null, { status: 401, headers });
    const session = sessionResult as { data?: { user?: unknown }; error?: unknown };
    if (session.error || !session.data?.user) return new Response(null, { status: 401, headers });
    const destinationResult: unknown = await client.rpc("resolve_my_store_admin_domain", { p_hostname: url.hostname });
    const sourceResult: unknown = source.origin === url.origin
      ? destinationResult
      : await client.rpc("resolve_my_store_admin_domain", { p_hostname: source.hostname });
    const destination = destinationResult as { data?: unknown; error?: unknown } | null;
    const origin = sourceResult as { data?: unknown; error?: unknown } | null;
    if (destination?.error || !Array.isArray(destination?.data) || destination.data.length !== 1 ||
      origin?.error || !Array.isArray(origin?.data) || origin.data.length !== 1) {
      await client.auth.signOut({ scope: "local" });
      return new Response(null, { status: 403, headers });
    }
    return new Response(null, { status: 303, headers: { ...headers, Location: new URL("/admin", url).toString() } });
  } catch {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    return new Response(null, { status: 401, headers });
  }
}
