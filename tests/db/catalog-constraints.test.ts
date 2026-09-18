import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const P = "d1000000-0000-4000-8000-000000000001";
const V = "d2000000-0000-4000-8000-000000000001";
const CB = "d3000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.products (id, tenant_id, store_id, slug, name, price_cents)
    values ('${P}', '${ids.tenantA}', '${ids.storeA}', 'produto-a', 'Produto A', 1299);
    insert into public.product_variants
      (id, tenant_id, store_id, product_id, name, price_cents)
    values ('${V}', '${ids.tenantA}', '${ids.storeA}', '${P}', 'P', 1299);
    insert into public.categories (id, tenant_id, store_id, slug, name)
    values ('${CB}', '${ids.tenantB}', '${ids.storeB}', 'cat-b-2', 'Cat B 2');
  `);
});

afterAll(async () => {
  await h.db.close();
});

describe("catalog composite constraints", () => {
  test("variante de outra store não pode apontar para produto A", async () => {
    await expectReject(
      h.db.query(`
        insert into public.product_variants
          (tenant_id, store_id, product_id, name, price_cents)
        values ('${ids.tenantB}', '${ids.storeB}', '${P}', 'X', 1)
      `),
      "variant cross-store",
    );
  });

  test("categoria parent de outra store é rejeitada", async () => {
    await expectReject(
      h.db.query(`
        insert into public.categories
          (tenant_id, store_id, parent_id, slug, name)
        values ('${ids.tenantA}', '${ids.storeA}', '${CB}', 'filha', 'Filha')
      `),
      "category parent cross-store",
    );
  });

  test("produto não pode usar categoria de outra store", async () => {
    await expectReject(
      h.db.query(`
        update public.products set category_id='${CB}'
        where tenant_id='${ids.tenantA}' and store_id='${ids.storeA}' and id='${P}'
      `),
      "product category cross-store",
    );
  });

  test("combinação de atributos duplicada no mesmo produto é rejeitada", async () => {
    await h.db.query(`
      insert into public.product_variants
        (tenant_id, store_id, product_id, name, attributes, price_cents)
      values (
        '${ids.tenantA}', '${ids.storeA}', '${P}', 'Azul P',
        '{"cor":"Azul","tamanho":"P"}'::jsonb, 1299
      )
    `);
    await expectReject(
      h.db.query(`
        insert into public.product_variants
          (tenant_id, store_id, product_id, name, attributes, price_cents)
        values (
          '${ids.tenantA}', '${ids.storeA}', '${P}', 'P Azul duplicada',
          '{"tamanho":"P","cor":"Azul"}'::jsonb, 1399
        )
      `),
      "duplicate variant attribute combination",
    );
  });

  test("object key R2 fora da store é rejeitada no banco", async () => {
    await expectReject(
      h.db.query(`
        insert into public.product_images
          (tenant_id, store_id, product_id, object_key)
        values (
          '${ids.tenantA}',
          '${ids.storeA}',
          '${P}',
          'tenants/${ids.tenantA}/stores/${ids.storeB}/product/x.png'
        )
      `),
      "image key cross-store",
    );
  });

  test("variante válida mantém seu preço", async () => {
    const rows = await h.db.query(`select price_cents from public.product_variants where id = '${V}'`);
    expect(Number(rows[0]?.["price_cents"])).toBe(1299);
  });
});
