import { describe,expect,test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root=join(import.meta.dir,"..","..");
const source=readFileSync(join(root,"apps/web/src/lib/server/mercadopago-oauth.functions.ts"),"utf8");
const migration=readFileSync(join(root,"supabase/migrations/0036_mercadopago_store_oauth.sql"),"utf8");
describe("Mercado Pago OAuth store checkout",()=>{
  test("uses authorization code with PKCE S256 and state",()=>{
    expect(source).toContain('code_challenge_method", "S256"');
    expect(source).toContain('url.searchParams.set("state"');
    expect(source).toContain('grant_type: "authorization_code"');
    expect(source).toContain("code_verifier");
  });
  test("state is one-use, expires and is bound to initiating actor",()=>{
    expect(source).toContain("consumed_at is null and expires_at>now()");
    expect(source).toContain("actor_user_id=$2::uuid");
    expect(migration).toContain("revoke all on table private.mercadopago_oauth_states");
  });
  test("tokens are encrypted server-side and never returned",()=>{
    expect(source).toContain("vault.encrypt(accessToken)");
    expect(source).toContain("vault.encrypt(refreshToken)");
    expect(source).not.toContain("return { accessToken");
  });
  test("connection is fixed to Mercado Pago store_checkout",()=>{
    expect(source).toContain("'store_checkout'");
    expect(source).toContain("'mercadopago'");
  });
});
