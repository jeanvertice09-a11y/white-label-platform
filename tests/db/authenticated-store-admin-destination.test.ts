import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { setupDatabase, type Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids=seedIds();

beforeAll(async()=>{
  h=await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.query(
    `insert into public.domains(tenant_id,store_id,hostname,type,status,verified_at)
     values
       ($1::uuid,$2::uuid,'admin-a.example.test','store_admin','active',now()),
       ($3::uuid,$4::uuid,'admin-b.example.test','store_admin','active',now())
     on conflict (hostname) do update set status='active',verified_at=excluded.verified_at`,
    [ids.tenantA,ids.storeA,ids.tenantB,ids.storeB],
  );
});
afterAll(async()=>{await h.db.close();});

describe("authenticated store admin destination",()=>{
  test("mantém o host atual quando pertence ao usuário",async()=>{
    const rows=await h.asUser(ids.users.storeA,"authenticated",()=>h.db.query(
      "select public.resolve_my_store_admin_destination($1) as hostname",
      ["admin-a.example.test"],
    ));
    expect(rows[0]?.["hostname"]).toBe("admin-a.example.test");
  });

  test("login feito no host de outra loja redireciona para a única loja autorizada",async()=>{
    const rows=await h.asUser(ids.users.storeA,"authenticated",()=>h.db.query(
      "select public.resolve_my_store_admin_destination($1) as hostname",
      ["admin-b.example.test"],
    ));
    expect(rows[0]?.["hostname"]).toBe("admin-a.example.test");
  });

  test("usuário sem membership não recebe destino administrativo",async()=>{
    const rows=await h.asUser(ids.users.tenantA,"authenticated",()=>h.db.query(
      "select public.resolve_my_store_admin_destination($1) as hostname",
      ["admin-a.example.test"],
    ));
    expect(rows[0]?.["hostname"]).toBeNull();
  });
});
