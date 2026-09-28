import { test } from "node:test";
import { strict as assert } from "node:assert";
import { handleAdminSessionHandoff } from "../../apps/web/src/lib/server/admin-session-handoff.server.ts";
import type { createRequestSupabaseClient } from "../../apps/web/src/lib/server/supabase-server.server.ts";

const source = "https://painel.loja.example";
const destination = "https://admin.loja.example/auth/handoff";
function request(origin = source, body = "access_token=access&refresh_token=refresh"): Request {
  return new Request(destination, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

function clientFactory(allowed: string[], calls: string[]) {
  return (() => ({
    auth: {
      setSession: () => Promise.resolve({ data: { user: { id: "user" } }, error: null }),
      signOut: () => { calls.push("signOut"); return Promise.resolve(); },
    },
    rpc: (_name: string, args: { p_hostname: string }) => {
      calls.push(args.p_hostname);
      return Promise.resolve({ data: allowed.includes(args.p_hostname) ? [{ tenant_id: "tenant", store_id: "store" }] : [], error: null });
    },
  })) as unknown as typeof createRequestSupabaseClient;
}

void test("transfers only when source and destination admin domains are authorized", async () => {
  const calls: string[] = [];
  const result = await handleAdminSessionHandoff(request(), clientFactory(["painel.loja.example", "admin.loja.example"], calls));
  assert.equal(result.status, 303);
  assert.equal(result.headers.get("location"), "https://admin.loja.example/admin");
  assert.deepEqual(calls, ["admin.loja.example", "painel.loja.example"]);
  assert.equal(result.headers.get("cache-control"), "no-store");
});

void test("rejects unauthorized destination and clears the session", async () => {
  const calls: string[] = [];
  const result = await handleAdminSessionHandoff(request(), clientFactory(["painel.loja.example"], calls));
  assert.equal(result.status, 403);
  assert.deepEqual(calls, ["admin.loja.example", "painel.loja.example", "signOut"]);
});

void test("rejects unauthorized source and missing or insecure origins", async () => {
  const calls: string[] = [];
  assert.equal((await handleAdminSessionHandoff(request(), clientFactory(["admin.loja.example"], calls))).status, 403);
  assert.equal((await handleAdminSessionHandoff(request("http://painel.loja.example"), clientFactory([], calls))).status, 403);
  assert.equal((await handleAdminSessionHandoff(request("null"), clientFactory([], calls))).status, 403);
});

void test("rejects missing credentials and oversized bodies before creating a client", async () => {
  const unused = () => { throw new Error("Client should not be created"); };
  assert.equal((await handleAdminSessionHandoff(request(source, "access_token=access"), unused)).status, 400);
  assert.equal((await handleAdminSessionHandoff(request(source, "x".repeat(8193)), unused)).status, 413);
});
