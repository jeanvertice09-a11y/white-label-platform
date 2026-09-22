import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const PRODUCT = "e1000000-0000-4000-8000-000000000001";
const PRODUCT_ASSET = "e2000000-0000-4000-8000-000000000001";
const PENDING_ASSET = "e2000000-0000-4000-8000-000000000002";
const BANNER_ASSET = "e2000000-0000-4000-8000-000000000003";
const OTHER_ASSET = "e2000000-0000-4000-8000-000000000004";
const LOGO_ASSET = "e2000000-0000-4000-8000-000000000005";

const productKey = () => `tenants/${ids.tenantA}/stores/${ids.storeA}/product/product.jpg`;
const pendingKey = () => `tenants/${ids.tenantA}/stores/${ids.storeA}/product/pending.png`;
const bannerKey = () => `tenants/${ids.tenantA}/stores/${ids.storeA}/banner/banner.webp`;
const otherKey = () => `tenants/${ids.tenantB}/stores/${ids.storeB}/product/other.jpg`;
const logoKey = () => `tenants/${ids.tenantA}/logo/logo.png`;
const logoUrl = () => `https://media.example/${logoKey()}`;

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.products(id,tenant_id,store_id,slug,name,price_cents)
    values ('${PRODUCT}','${ids.tenantA}','${ids.storeA}','media-product','Media Product',1000);

    insert into public.media_assets(id,tenant_id,store_id,object_key,public_url,kind,content_type,size_bytes,status,upload_expires_at)
    values
      ('${PRODUCT_ASSET}','${ids.tenantA}','${ids.storeA}','${productKey()}','https://media.example/${productKey()}','product','image/jpeg',100,'ready',now()+interval '10 minutes'),
      ('${PENDING_ASSET}','${ids.tenantA}','${ids.storeA}','${pendingKey()}','https://media.example/${pendingKey()}','product','image/png',100,'pending',now()+interval '10 minutes'),
      ('${BANNER_ASSET}','${ids.tenantA}','${ids.storeA}','${bannerKey()}','https://media.example/${bannerKey()}','banner','image/webp',100,'ready',now()+interval '10 minutes'),
      ('${OTHER_ASSET}','${ids.tenantB}','${ids.storeB}','${otherKey()}','https://media.example/${otherKey()}','product','image/jpeg',100,'ready',now()+interval '10 minutes'),
      ('${LOGO_ASSET}','${ids.tenantA}',null,'${logoKey()}','${logoUrl()}','logo','image/png',100,'ready',now()+interval '10 minutes');
  `);
});

afterAll(async () => { await h.db.close(); });

describe("media asset database boundary", () => {
  test("new product association auto-binds only the READY store asset", async () => {
    const rows = await h.db.query(`
      insert into public.product_images(tenant_id,store_id,product_id,object_key,position)
      values ('${ids.tenantA}','${ids.storeA}','${PRODUCT}','${productKey()}',0)
      returning asset_id::text
    `);
    expect(rows[0]?.["asset_id"]).toBe(PRODUCT_ASSET);
  });

  test("pending upload cannot be associated", async () => {
    await expectReject(h.db.query(`
      insert into public.product_images(tenant_id,store_id,product_id,object_key,position)
      values ('${ids.tenantA}','${ids.storeA}','${PRODUCT}','${pendingKey()}',1)
    `), "pending media asset");
  });

  test("asset from another tenant/store cannot be associated", async () => {
    await expectReject(h.db.query(`
      insert into public.product_images(tenant_id,store_id,product_id,object_key,position)
      values ('${ids.tenantA}','${ids.storeA}','${PRODUCT}','${otherKey()}',2)
    `), "cross-store media asset");
  });

  test("banner association binds the matching banner asset", async () => {
    const rows = await h.db.query(`
      insert into public.store_banners(tenant_id,store_id,image_object_key,position)
      values ('${ids.tenantA}','${ids.storeA}','${bannerKey()}',0)
      returning asset_id::text
    `);
    expect(rows[0]?.["asset_id"]).toBe(BANNER_ASSET);
  });

  test("kind mismatch is rejected even with a scoped key", async () => {
    await expectReject(h.db.query(`
      insert into public.store_banners(tenant_id,store_id,image_object_key,position)
      values ('${ids.tenantA}','${ids.storeA}','${productKey()}',1)
    `), "media kind mismatch");
  });

  test("tenant branding accepts only a READY logo asset from the same tenant", async () => {
    await h.db.query(`
      insert into public.tenant_branding(tenant_id,logo_url,logo_asset_id)
      values ('${ids.tenantA}','${logoUrl()}','${LOGO_ASSET}')
      on conflict (tenant_id) do update set logo_url=excluded.logo_url,logo_asset_id=excluded.logo_asset_id
    `);
    const rows = await h.db.query(`select logo_asset_id::text from public.tenant_branding where tenant_id='${ids.tenantA}'`);
    expect(rows[0]?.["logo_asset_id"]).toBe(LOGO_ASSET);
    await expectReject(h.db.query(`
      update public.tenant_branding
      set logo_asset_id='${PRODUCT_ASSET}',logo_url='https://media.example/${productKey()}'
      where tenant_id='${ids.tenantA}'
    `), "logo kind mismatch");
  });
});
