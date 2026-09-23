import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { setupDatabase, expectReject } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const userB = ids.users.storeB;
const productA = "42000000-0000-4000-8000-00000000000a";

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
insert into public.products(id,tenant_id,store_id,slug,name,price_cents)
values ('${productA}','${ids.tenantA}','${ids.storeA}','isolation-product','Isolation Product',100);
`);
});

afterAll(async () => { await h.db.close(); });

describe("authorization isolation hardening", () => {
  test("service role não atribui movimento de estoque a usuário de outra store", async () => {
    await expectReject(
      h.db.query(
        `insert into public.stock_movements
          (tenant_id,store_id,product_id,delta,reason,movement_type,created_by)
         values ($1::uuid,$2::uuid,$3::uuid,1,'cross actor','manual',$4::uuid)`,
        [ids.tenantA, ids.storeA, productA, userB],
      ),
      "cross-store stock actor",
    );
  });

  test("RLS autenticado continua fail-closed para escrita mesmo conhecendo UUID", async () => {
    const changed = await h.asUser(ids.users.storeA, "authenticated", () =>
      h.db.query(
        `update public.products set name='cross'
         where tenant_id='${ids.tenantB}' and store_id='${ids.storeB}'
         returning id`,
      ),
    );
    expect(changed).toHaveLength(0);
  });
});
