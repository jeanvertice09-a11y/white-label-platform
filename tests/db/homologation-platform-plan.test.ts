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
  test("segue o schema real e é create-only/fail-closed", async () => {
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
    const expected = {
      slug: "hml-white-label",
      name: "Homologação White Label",
      price_cents: 19900,
      active: true,
      billing_interval: "monthly",
    };
    const readPlan = async () => h.db.query(
      `select slug,name,price_cents,active,billing_interval
       from public.plans where slug='hml-white-label'`,
    );
    expect(await readPlan()).toEqual([expected]);

    await h.db.execScript(platformPlanSql);
    expect(await readPlan()).toEqual([expected]);
    expect(await h.db.query(
      "select count(*)::int total from public.plans where slug='hml-white-label'",
    )).toEqual([{ total: 1 }]);

    const divergences = [
      ["name", "'Plano divergente'", "Plano divergente"],
      ["price_cents", "19800", 19800],
      ["active", "false", false],
      ["billing_interval", "'yearly'", "yearly"],
    ] as const;

    for (const [column, sqlValue, expectedValue] of divergences) {
      await h.db.execScript(`update public.plans set ${column}=${sqlValue} where slug='hml-white-label';`);
      await expectReject(h.db.execScript(platformPlanSql), `${column} divergente deve falhar fechado`);
      const rows = await h.db.query(`select ${column} from public.plans where slug='hml-white-label'`);
      expect(rows[0]?.[column]).toBe(expectedValue);
      await h.db.execScript(
        `delete from public.plans where slug='hml-white-label';\n${platformPlanSql}`,
      );
    }
  });
});
