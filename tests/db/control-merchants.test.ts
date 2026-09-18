import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Harness } from "./harness.ts";
import { setupDatabase } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";
import {
  getControlMerchantDetail,
  listControlMerchants,
} from "../../apps/web/src/lib/server/control-merchants.read.server.ts";
import {
  changeControlMerchantOwner,
  createControlMerchant,
  setControlMerchantStatus,
  updateControlMerchant,
} from "../../apps/web/src/lib/server/control-merchants.write.server.ts";
import {
  assignControlMerchantPlan,
  setControlSubscriptionStatus,
} from "../../apps/web/src/lib/server/control-merchants.billing.server.ts";

let h: Harness;
const ids = seedIds();
const actor = ids.users.tenantA;
const ownerA = "10000000-0000-4000-8000-000000000001";
const ownerB = "10000000-0000-4000-8000-000000000002";
let planA = "";
let planB = "";

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    create table if not exists auth.users (
      id uuid primary key,
      email text unique
    );
  `);
  await h.db.query(
    `insert into auth.users(id,email) values
      ($1,'owner-a@example.test'),($2,'owner-b@example.test')
     on conflict (id) do nothing`,
    [ownerA, ownerB],
  );
  const templates = await h.db.query(
    "select id from public.plan_templates where code='monthly_entry' limit 1",
  );
  const templateId = String(templates[0]?.["id"] ?? "");
  const templateB = await h.db.query(
    "select id from public.plan_templates where code='monthly_intermediate' limit 1",
  );
  const templateBId = String(templateB[0]?.["id"] ?? "");
  const plansA = await h.db.query(
    `insert into public.tenant_plans(
       tenant_id,template_id,slug,name,price_cents,trial_enabled,trial_days
     ) values ($1,$2,'fase5-a','Fase 5 A',1000,true,7)
     returning id::text`,
    [ids.tenantA, templateId],
  );
  const plansB = await h.db.query(
    `insert into public.tenant_plans(
       tenant_id,template_id,slug,name,price_cents,trial_enabled,trial_days
     ) values ($1,$2,'fase5-b','Fase 5 B',2000,true,5)
     returning id::text`,
    [ids.tenantB, templateBId],
  );
  planA = String(plansA[0]?.["id"] ?? "");
  planB = String(plansB[0]?.["id"] ?? "");
});

afterAll(async () => {
  await h.db.close();
});

describe("fase 05 control merchants", () => {
  test("listagem e detalhe são tenant-scoped", async () => {
    const list = await listControlMerchants(
      h.db,
      ids.tenantA,
      { query: "", status: "all", page: 1, pageSize: 20 },
    );
    expect(list.items.some((item) => item.id === ids.storeA)).toBe(true);
    expect(list.items.some((item) => item.id === ids.storeB)).toBe(false);
    expect(await getControlMerchantDetail(h.db, ids.tenantA, ids.storeB)).toBeNull();
  });

  test("criação é atômica, cria owner, trial real e suporta retry", async () => {
    const input = {
      name: "Loja Trial",
      slug: "loja-trial-fase5",
      ownerEmail: "owner-a@example.test",
      planId: planA,
      useTrial: true,
    };
    const first = await createControlMerchant(h.db, ids.tenantA, actor, input);
    const retry = await createControlMerchant(h.db, ids.tenantA, actor, input);
    expect(first.created).toBe(true);
    expect(retry.id).toBe(first.id);
    expect(retry.created).toBe(false);

    const owner = await h.db.query(
      "select role from public.store_members where tenant_id=$1 and store_id=$2 and user_id=$3",
      [ids.tenantA, first.id, ownerA],
    );
    expect(owner[0]?.["role"]).toBe("store_owner");
    const subscription = await h.db.query(
      `select status,trial_started_at,trial_ends_at from public.store_subscriptions
       where tenant_id=$1 and store_id=$2`,
      [ids.tenantA, first.id],
    );
    expect(subscription[0]?.["status"]).toBe("trialing");
    expect(subscription[0]?.["trial_started_at"]).not.toBeNull();
    expect(subscription[0]?.["trial_ends_at"]).not.toBeNull();
  });

  test("owner inválido e plano cross-tenant não deixam store parcial", async () => {
    await expect(
      createControlMerchant(h.db, ids.tenantA, actor, {
        name: "Owner inválido",
        slug: "owner-invalido-fase5",
        ownerEmail: "missing@example.test",
        planId: null,
        useTrial: false,
      }),
    ).rejects.toThrow();
    await expect(
      createControlMerchant(h.db, ids.tenantA, actor, {
        name: "Plano cruzado",
        slug: "plano-cruzado-fase5",
        ownerEmail: "owner-a@example.test",
        planId: planB,
        useTrial: false,
      }),
    ).rejects.toThrow();
    const partial = await h.db.query(
      "select id from public.stores where tenant_id=$1 and slug in ('owner-invalido-fase5','plano-cruzado-fase5')",
      [ids.tenantA],
    );
    expect(partial).toHaveLength(0);
  });

  test("edição, troca de owner, suspensão e reativação são auditadas", async () => {
    const created = await createControlMerchant(h.db, ids.tenantA, actor, {
      name: "Loja Gestão",
      slug: "loja-gestao-fase5",
      ownerEmail: "owner-a@example.test",
      planId: null,
      useTrial: false,
    });
    await updateControlMerchant(
      h.db,
      ids.tenantA,
      actor,
      { storeId: created.id, name: "Loja Gestão Editada", slug: "loja-gestao-editada" },
    );
    await changeControlMerchantOwner(
      h.db,
      ids.tenantA,
      actor,
      created.id,
      "owner-b@example.test",
    );
    await setControlMerchantStatus(h.db, ids.tenantA, actor, created.id, "suspended");
    await setControlMerchantStatus(h.db, ids.tenantA, actor, created.id, "active");

    const owners = await h.db.query(
      `select user_id::text from public.store_members
       where tenant_id=$1 and store_id=$2 and role='store_owner'`,
      [ids.tenantA, created.id],
    );
    expect(owners).toHaveLength(1);
    expect(owners[0]?.["user_id"]).toBe(ownerB);
    const audits = await h.db.query(
      `select action from public.audit_logs
       where tenant_id=$1 and store_id=$2 order by created_at`,
      [ids.tenantA, created.id],
    );
    expect(audits.map((row) => row["action"])).toEqual([
      "control.store.created",
      "control.store.updated",
      "control.store.owner_changed",
      "control.store.suspended",
      "control.store.reactivated",
    ]);
  });

  test("plano e subscription respeitam tenant, trial e transições", async () => {
    const created = await createControlMerchant(h.db, ids.tenantA, actor, {
      name: "Loja Billing",
      slug: "loja-billing-fase5",
      ownerEmail: "owner-a@example.test",
      planId: null,
      useTrial: false,
    });
    await expect(
      assignControlMerchantPlan(h.db, ids.tenantA, actor, created.id, planB, false),
    ).rejects.toThrow();
    const subscription = await assignControlMerchantPlan(
      h.db,
      ids.tenantA,
      actor,
      created.id,
      planA,
      true,
    );
    expect(subscription.status).toBe("trialing");
    const active = await setControlSubscriptionStatus(
      h.db,
      ids.tenantA,
      actor,
      created.id,
      subscription.subscriptionId,
      "active",
    );
    expect(active.status).toBe("active");
  });
});
