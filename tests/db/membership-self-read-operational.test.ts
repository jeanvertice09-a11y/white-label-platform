import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { setupDatabase, type Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids=seedIds();
beforeAll(async()=>{h=await setupDatabase();await h.db.execScript(seedSql());});
afterAll(async()=>{await h.db.close();});

describe("authenticated membership operational scope",()=>{
  test("store member sees only its own active store membership",async()=>{
    const rows=await h.asUser(ids.users.storeA,"authenticated",()=>h.db.query(
      "select tenant_id::text,store_id::text,role from public.store_members order by store_id",
    ));
    expect(rows).toEqual([{tenant_id:ids.tenantA,store_id:ids.storeA,role:"store_admin"}]);
  });

  test("tenant member sees only its own active tenant membership",async()=>{
    const rows=await h.asUser(ids.users.tenantA,"authenticated",()=>h.db.query(
      "select tenant_id::text,role from public.tenant_members order by tenant_id",
    ));
    expect(rows).toEqual([{tenant_id:ids.tenantA,role:"tenant_owner"}]);
  });

  test("cross-store remains invisible",async()=>{
    const rows=await h.asUser(ids.users.storeA,"authenticated",()=>h.db.query(
      "select store_id::text from public.store_members where store_id=$1::uuid",
      [ids.storeB],
    ));
    expect(rows).toEqual([]);
  });
});
