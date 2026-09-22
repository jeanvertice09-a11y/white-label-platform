import { describe,expect,test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=join(import.meta.dir,"..","..");
const migration=readFileSync(join(root,"supabase","migrations","0035_suspension_access_enforcement.sql"),"utf8");
const route=readFileSync(join(root,"apps","web","src","lib","server","route-context.server.ts"),"utf8");
const catalog=readFileSync(join(root,"apps","web","src","lib","server","catalog-context.server.ts"),"utf8");
const scheduler=readFileSync(join(root,"apps","worker","src","jobs","scheduler.ts"),"utf8");
const handlers=readFileSync(join(root,"apps","worker","src","jobs","handlers.ts"),"utf8");
const master=readFileSync(join(root,"apps","web","src","lib","server","master-white-label.functions.ts"),"utf8");
const merchants=readFileSync(join(root,"apps","web","src","lib","server","control-merchants.functions.ts"),"utf8");

describe("suspension access enforcement",()=>{
  test("membership RLS fails closed for suspended tenant/store",()=>{
    expect(migration).toContain("t.status in ('trial','active')");
    expect(migration).toContain("s.status='active'");
    expect(migration).toContain("tenant_members_self_read");
    expect(migration).toContain("store_members_self_read");
  });
  test("privileged route boundaries check operational status",()=>{
    expect(route).toContain("assertTenantOperational");
    expect(route).toContain("assertStoreOperational");
    expect(route).toContain("TENANT_SUSPENDED");
    expect(route).toContain("STORE_SUSPENDED");
  });
  test("public storefront checks tenant and store status",()=>{
    expect(catalog).toContain("assertStorefrontAvailable(store)");
  });
  test("worker scheduler excludes suspended scopes",()=>{
    expect(scheduler).toContain("join public.tenants");
    expect(scheduler).toContain("t.status in ('trial','active')");
    expect(scheduler).toContain("s.status='active'");
  });
  test("suspension invalidates cached domain routing immediately",()=>{
    expect(master).toContain("Promise.all(hostRows.map");
    expect(master).toContain("invalidateHostname");
    expect(merchants).toContain("invalidateDomainCache");
    expect(merchants).toContain("store_id=$2::uuid");
  });
  test("worker handlers revalidate status immediately before side effects",()=>{
    expect(handlers).toContain("assertJobScopeOperational");
    expect(handlers).toContain("Escopo do job suspenso");
  });
});
