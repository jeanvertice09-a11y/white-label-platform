import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DEMO_COUNTS, DEMO_TENANTS } from "../../scripts/homologation/fixtures/data.ts";
import { applyHomologationSeed } from "../../scripts/homologation/seed.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { homologationTestConfig, prepareHomologationHarness } from "./homologation-fixture.ts";

let h: Harness;
const config = homologationTestConfig();
const tenantIds = DEMO_TENANTS.map((tenant) => tenant.id);

async function scalar(sql: string): Promise<number> {
  const rows = await h.db.query(sql, [tenantIds]);
  return Number(rows[0]?.["total"] ?? 0);
}

beforeAll(async () => {
  h = await setupDatabase();
  config.resolvedAssets = {};
  config.tenantLogoUrls = { aurora: "", nexo: "" };
  config.mediaOrigin = "";
  await prepareHomologationHarness(h, config);
  await applyHomologationSeed(h.db, config, { mediaMode: "deferred" });
});

afterAll(async () => { await h.db.close(); });

describe("homologation functional seed with deferred media", () => {
  test("keeps the complete functional mass while media tables stay empty", async () => {
    expect(await scalar("select count(*)::int total from public.tenants where id=any($1::uuid[])")).toBe(DEMO_COUNTS.tenants);
    expect(await scalar("select count(*)::int total from public.stores where tenant_id=any($1::uuid[])")).toBe(DEMO_COUNTS.stores);
    expect(await scalar("select count(*)::int total from public.products where tenant_id=any($1::uuid[])")).toBe(DEMO_COUNTS.products);
    expect(await scalar("select count(*)::int total from public.product_variants where tenant_id=any($1::uuid[])")).toBe(DEMO_COUNTS.variants);
    expect(await scalar("select count(*)::int total from public.customers where tenant_id=any($1::uuid[])")).toBe(DEMO_COUNTS.customers);
    expect(await scalar("select count(*)::int total from public.orders where tenant_id=any($1::uuid[])")).toBe(DEMO_COUNTS.orders);
    expect(await scalar("select count(*)::int total from public.media_assets where tenant_id=any($1::uuid[])")).toBe(0);
    expect(await scalar("select count(*)::int total from public.product_images where tenant_id=any($1::uuid[])")).toBe(0);
    expect(await scalar("select count(*)::int total from public.store_banners where tenant_id=any($1::uuid[])")).toBe(0);
    expect(await scalar("select count(*)::int total from public.tenant_branding where tenant_id=any($1::uuid[]) and logo_url is not null")).toBe(0);
  });

  test("preserves the two storefront layouts", async () => {
    const rows = await h.db.query(
      `select layout,count(*)::int total from public.catalog_settings
       where tenant_id=any($1::uuid[]) group by layout order by layout`,
      [tenantIds],
    );
    expect(rows).toEqual([{ layout: "classic", total: 2 }, { layout: "modern", total: 2 }]);
  });
});
