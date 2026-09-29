import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Harness, Row } from "./harness.ts";
import { expectReject, setupDatabase } from "./harness.ts";
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

function firstText(rows: Row[], key: string): string {
  const value = rows.at(0)?.[key];
  if (typeof value !== "string") throw new Error(`Campo ausente: ${key}`);
  return value;
}

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
    "select id::text from public.plan_templates where code='monthly_entry' limit 1",
  );
  const templateB = await h.db.query(
    "select id::text from public.plan_templates where code='monthly_intermediate' limit 1",
  );
  const plansA = await h.db.query(
    `insert into public.tenant_plans(
       tenant_id,template_id,slug,name,price_cents,trial_enabled,trial_days
     ) values ($1,$2,'fase5-a','Fase 5 A',1000,true,7)
     returning id::text`,
    [ids.tenantA, firstText(templates, "id")],
  );
  const plansB = await h.db.query(
    `insert into public.tenant_plans(
       tenant_id,template_id,slug,name,price_cents,trial_enabled,trial_days
     ) values ($1,$2,'fase5-b','Fase 5 B',2000,true,5)
     returning id::text`,
    [ids.tenantB, firstText(templateB, "id")],
  );
  planA = firstText(plansA, "id");
  planB = firstText(plansB, "id");
});

afterAll(async () => {
  await h.db.close();
});

describe("fase 05 control merchants", () => {
  test("listagem, busca, filtro e detalhe são tenant-scoped", async () => {
    const list = await listControlMerchants(
      h.db,
      ids.tenantA,
      { query: "Loja A", status: "active", page: 1, pageSize: 1 },
    );
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.id).toBe(ids.storeA);
    expect(list.items.some((item) => item.id === ids.storeB)).toBe(false);
    expect(list.page).toBe(1);
    expect(list.pageSize).toBe(1);
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
    expect(owner.at(0)?.["role"]).toBe("store_owner");
    const subscription = await h.db.query(
      `select status,trial_started_at,trial_ends_at from public.store_subscriptions
       where tenant_id=$1 and store_id=$2`,
      [ids.tenantA, first.id],
    );
    expect(subscription.at(0)?.["status"]).toBe("trialing");
    expect(subscription.at(0)?.["trial_started_at"]).not.toBeNull();
    expect(subscription.at(0)?.["trial_ends_at"]).not.toBeNull();
  });

  test("owner inválido e plano cross-tenant não deixam store parcial", async () => {
    await expectReject(
      createControlMerchant(h.db, ids.tenantA, actor, {
        name: "Owner inválido",
        slug: "owner-invalido-fase5",
        ownerEmail: "missing@example.test",
        planId: null,
        useTrial: false,
      }),
      "owner Auth inválido",
    );
    await expectReject(
      createControlMerchant(h.db, ids.tenantA, actor, {
        name: "Plano cruzado",
        slug: "plano-cruzado-fase5",
        ownerEmail: "owner-a@example.test",
        planId: planB,
        useTrial: false,
      }),
      "plano de outro tenant",
    );
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
    expect(owners.at(0)?.["user_id"]).toBe(ownerB);
    const audits = await h.db.query(
      `select action,metadata::text metadata from public.audit_logs
       where tenant_id=$1 and store_id=$2 order by created_at`,
      [ids.tenantA, created.id],
    );
    const expectedActions = [
      "control.store.created",
      "control.store.updated",
      "control.store.owner_changed",
      "control.store.suspended",
      "control.store.reactivated",
    ];
    const actions = audits.map((row) => row["action"]);
    expect(actions).toHaveLength(expectedActions.length);
    for (const action of expectedActions) expect(actions).toContain(action);
    expect(audits.every((row) => !String(row["metadata"]).includes("password"))).toBe(true);
  });

  test("IDOR: tenant A não edita, troca owner ou suspende Store B", async () => {
    await expectReject(
      updateControlMerchant(h.db, ids.tenantA, actor, {
        storeId: ids.storeB,
        name: "Invadida",
        slug: "invadida",
      }),
      "editar store de outro tenant",
    );
    await expectReject(
      changeControlMerchantOwner(h.db, ids.tenantA, actor, ids.storeB, "owner-a@example.test"),
      "owner em store de outro tenant",
    );
    await expectReject(
      setControlMerchantStatus(h.db, ids.tenantA, actor, ids.storeB, "suspended"),
      "suspender store de outro tenant",
    );
    const storeB = await h.db.query("select name,status from public.stores where id=$1", [ids.storeB]);
    expect(storeB.at(0)?.["name"]).toBe("Loja B (teste)");
    expect(storeB.at(0)?.["status"]).toBe("active");
  });

  test("subscription respeita tenant, trial, suspensão, reativação e cancelamento", async () => {
    const created = await createControlMerchant(h.db, ids.tenantA, actor, {
      name: "Loja Billing",
      slug: "loja-billing-fase5",
      ownerEmail: "owner-a@example.test",
      planId: null,
      useTrial: false,
    });
    await expectReject(
      assignControlMerchantPlan(h.db, ids.tenantA, actor, created.id, planB, false),
      "plano cross-tenant",
    );
    const subscription = await assignControlMerchantPlan(
      h.db, ids.tenantA, actor, created.id, planA, true,
    );
    expect(subscription.status).toBe("trialing");
    await setControlSubscriptionStatus(
      h.db, ids.tenantA, actor, created.id, subscription.subscriptionId, "active",
    );
    await setControlSubscriptionStatus(
      h.db, ids.tenantA, actor, created.id, subscription.subscriptionId, "suspended",
    );
    await setControlSubscriptionStatus(
      h.db, ids.tenantA, actor, created.id, subscription.subscriptionId, "active",
    );
    const canceled = await setControlSubscriptionStatus(
      h.db, ids.tenantA, actor, created.id, subscription.subscriptionId, "canceled",
    );
    expect(canceled.status).toBe("canceled");
  });

  test("trial pode expirar e subscription de outro tenant não pode ser alterada", async () => {
    const created = await createControlMerchant(h.db, ids.tenantA, actor, {
      name: "Loja Trial Expira",
      slug: "loja-trial-expira-fase5",
      ownerEmail: "owner-a@example.test",
      planId: planA,
      useTrial: true,
    });
    const detail = await getControlMerchantDetail(h.db, ids.tenantA, created.id);
    if (!detail?.merchant.subscriptionId) throw new Error("subscription de trial ausente");
    const expired = await setControlSubscriptionStatus(
      h.db, ids.tenantA, actor, created.id, detail.merchant.subscriptionId, "expired",
    );
    expect(expired.status).toBe("expired");

    const foreign = await h.db.query(
      `insert into public.store_subscriptions(tenant_id,store_id,tenant_plan_id,status)
       values ($1,$2,$3,'active') returning id::text`,
      [ids.tenantB, ids.storeB, planB],
    );
    await expectReject(
      setControlSubscriptionStatus(
        h.db, ids.tenantA, actor, ids.storeB, firstText(foreign, "id"), "suspended",
      ),
      "subscription de outro tenant",
    );
  });
});
