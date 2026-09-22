import { afterAll,beforeAll,describe,expect,test } from "bun:test";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { S,T,U,seedSql } from "./seed.ts";

let h:Harness;
beforeAll(async()=>{h=await setupDatabase();await h.db.execScript(seedSql());});
afterAll(async()=>{await h.db.close();});

describe("suspension access DB boundary",()=>{
  test("suspending tenant hides its memberships and resources from authenticated member",async()=>{
    await h.db.execOne(`update public.tenants set status='suspended' where id='${T.a}'`);
    const memberships=await h.asUser(U.tenantA,"authenticated",()=>h.db.query("select tenant_id::text from public.tenant_members"));
    expect(memberships).toHaveLength(0);
    const stores=await h.asUser(U.tenantA,"authenticated",()=>h.db.query("select id::text from public.stores"));
    expect(stores).toHaveLength(0);
  });

  test("suspending store hides store membership and store-scoped resources",async()=>{
    await h.db.execOne(`update public.tenants set status='active' where id='${T.a}'`);
    await h.db.execOne(`update public.stores set status='suspended' where tenant_id='${T.a}' and id='${S.a}'`);
    const memberships=await h.asUser(U.storeA,"authenticated",()=>h.db.query("select store_id::text from public.store_members"));
    expect(memberships).toHaveLength(0);
    const products=await h.asUser(U.storeA,"authenticated",()=>h.db.query(`select id::text from public.products where tenant_id='${T.a}' and store_id='${S.a}'`));
    expect(products).toHaveLength(0);
  });
});
