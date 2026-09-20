import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";

let h: Harness;
const platformPlanSql = readFileSync(
  join(import.meta.dir, "..", "..", "scripts", "homologation", "platform-plan.example.sql"),
  "utf8",
);

beforeAll(async () => { h = await setupDatabase(); });
afterAll(async () => { await h.db.close(); });

describe("homologation platform plan SQL", () => {
  test("segue o schema real, cria o plano HML e falha fechado no rerun", async () => {
    const columns = await h.db.query(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='plans' order by ordinal_position`,
    );
    expect(columns.map((row) => row["column_name"])).toEqual([
      "id", "slug", "name", "price_cents", "active", "billing_interval",
    ]);
    expect(platformPlanSql.toLowerCase()).not.toContain("currency");
    expect(platformPlanSql.toLowerCase()).not.toContain("update public.plans");
    expect(platformPlanSql.toLowerCase()).not.toContain("on conflict");

    await h.db.execScript(platformPlanSql);
    const rows = await h.db.query(
      `select slug,name,price_cents,active,billing_interval
       from public.plans where slug='hml-white-label'`,
    );
    expect(rows).toEqual([{
      slug: "hml-white-label",
      name: "Homologação White Label",
      price_cents: 19900,
      active: true,
      billing_interval: "monthly",
    }]);

    await expectReject(h.db.execScript(platformPlanSql), "slug HML existente deve falhar fechado");
    const after = await h.db.query(
      `select count(*)::int total,min(price_cents)::int price_cents
       from public.plans where slug='hml-white-label'`,
    );
    expect(after).toEqual([{ total: 1, price_cents: 19900 }]);
  });
});
