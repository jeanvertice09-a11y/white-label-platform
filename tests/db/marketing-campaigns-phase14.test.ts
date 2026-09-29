import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createCustomerRepository } from "../../packages/customers/src/index.ts";
import { createOrderRepository } from "../../packages/orders/src/index.ts";
import { createCampaignRepository } from "../../packages/marketing/src/index.ts";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const scopeA = { tenantId: ids.tenantA, storeId: ids.storeA };
const scopeB = { tenantId: ids.tenantB, storeId: ids.storeB };
const PRODUCT = "f1400000-0000-4000-8000-000000000001";
let customerA = "";
let customerB = "";
let customerC = "";
let customerD = "";

function campaignInput(
  name: string,
  segmentType: "all" | "with_orders" | "without_orders" = "all",
  scheduledAt: string | null = null,
) {
  return {
    name,
    content: "Conteúdo <script>não executável</script>",
    segmentType,
    scheduledAt,
  };
}

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.products
      (id,tenant_id,store_id,slug,name,price_cents,active)
    values ('${PRODUCT}','${ids.tenantA}','${ids.storeA}',
      'phase14-product','Produto Phase 14',3000,true);
  `);

  const customers = createCustomerRepository(h.db);
  const a = await customers.create(scopeA, {
    name: "Customer A Opt-in",
    phone: "62914140001",
    email: "a@example.test",
    document: null,
    birthDate: null,
    notes: null,
  });
  const b = await customers.create(scopeA, {
    name: "Customer B Sem Opt-in",
    phone: "62914140002",
    email: "b@example.test",
    document: null,
    birthDate: null,
    notes: null,
  });
  const c = await customers.create(scopeA, {
    name: "Customer C Opt-out",
    phone: "62914140003",
    email: "c@example.test",
    document: null,
    birthDate: null,
    notes: null,
  });
  const d = await customers.create(scopeA, {
    name: "Customer D Opt-in sem pedido",
    phone: "62914140004",
    email: null,
    document: null,
    birthDate: null,
    notes: null,
  });
  customerA = a.id;
  customerB = b.id;
  customerC = c.id;
  customerD = d.id;

  const marketing = createCampaignRepository(h.db);
  await marketing.recordConsent(scopeA, {
    customerId: customerA,
    status: "opted_in",
    source: "customer_form",
  });
  await marketing.recordConsent(scopeA, {
    customerId: customerC,
    status: "opted_out",
    source: "customer_request",
  });
  await marketing.recordConsent(scopeA, {
    customerId: customerD,
    status: "opted_in",
    source: "customer_form",
  });

  const orders = createOrderRepository(h.db);
  await orders.createFromCart(scopeA, {
    idempotencyKey: "phase14-order-a",
    origin: "whatsapp",
    customerName: "Customer A Opt-in",
    customerPhone: "62914140001",
    notes: null,
    shippingCents: 0,
    items: [{ productId: PRODUCT, variantId: null, quantity: 1 }],
  });
});

afterAll(async () => {
  await h.db.close();
});

describe("phase 14 marketing campaigns", () => {
  test("cenário integrado respeita opt-in, opt-out e ausência de consentimento", async () => {
    const marketing = createCampaignRepository(h.db);
    const campaign = await marketing.create(
      scopeA,
      campaignInput("Campanha integrada"),
      ids.users.storeA,
    );
    const prepared = await marketing.prepare(
      scopeA,
      campaign.id,
      ids.users.storeA,
    );
    expect(prepared?.status).toBe("prepared");
    expect(prepared?.recipientCount).toBe(2);

    const detail = await marketing.getById(scopeA, campaign.id);
    const customerIds = detail?.recipients.map((item) => item.customerId).sort();
    expect(customerIds).toEqual([customerA, customerD].sort());
    expect(customerIds).not.toContain(customerB);
    expect(customerIds).not.toContain(customerC);

    await marketing.prepare(scopeA, campaign.id, ids.users.storeA);
    const retry = await marketing.getById(scopeA, campaign.id);
    expect(retry?.recipientCount).toBe(2);
  });

  test("segmentação é calculada server-side com dados reais de pedidos", async () => {
    const marketing = createCampaignRepository(h.db);
    const withOrders = await marketing.create(
      scopeA,
      campaignInput("Com pedidos", "with_orders"),
    );
    await marketing.prepare(scopeA, withOrders.id);
    const withDetail = await marketing.getById(scopeA, withOrders.id);
    expect(withDetail?.recipients.map((item) => item.customerId)).toEqual([
      customerA,
    ]);

    const withoutOrders = await marketing.create(
      scopeA,
      campaignInput("Sem pedidos", "without_orders"),
    );
    await marketing.prepare(scopeA, withoutOrders.id);
    const withoutDetail = await marketing.getById(scopeA, withoutOrders.id);
    expect(withoutDetail?.recipients.map((item) => item.customerId)).toEqual([
      customerD,
    ]);
  });

  test("prepare concorrente e retry não duplicam recipient", async () => {
    const marketing = createCampaignRepository(h.db);
    const campaign = await marketing.create(scopeA, campaignInput("Concorrência"));
    await Promise.all([
      marketing.prepare(scopeA, campaign.id),
      marketing.prepare(scopeA, campaign.id),
    ]);
    const rows = await h.db.query(
      `select customer_id,count(*)::integer as total
       from public.marketing_campaign_recipients
       where tenant_id=$1 and store_id=$2 and campaign_id=$3
       group by customer_id`,
      [scopeA.tenantId, scopeA.storeId, campaign.id],
    );
    expect(rows.every((row) => Number(row["total"]) === 1)).toBe(true);
  });

  test("agendamento futuro não cruza a fronteira do provider antes da hora", async () => {
    const marketing = createCampaignRepository(h.db);
    const campaign = await marketing.create(
      scopeA,
      campaignInput("Futura", "all", "2099-01-01T12:00:00.000Z"),
    );
    const prepared = await marketing.prepare(scopeA, campaign.id);
    expect(prepared?.status).toBe("scheduled");
    expect(
      await marketing.listProviderBoundaryRecipients(scopeA, campaign.id),
    ).toHaveLength(0);
  });

  test("opt-out posterior ao snapshot bloqueia na fronteira do provider", async () => {
    const marketing = createCampaignRepository(h.db);
    await marketing.recordConsent(scopeA, {
      customerId: customerA,
      status: "opted_in",
      source: "customer_form",
    });
    const campaign = await marketing.create(
      scopeA,
      campaignInput("Revogação posterior", "with_orders"),
    );
    await marketing.prepare(scopeA, campaign.id);
    await marketing.recordConsent(scopeA, {
      customerId: customerA,
      status: "opted_out",
      source: "customer_request",
    });

    expect(
      await marketing.listProviderBoundaryRecipients(scopeA, campaign.id),
    ).toHaveLength(0);
    const detail = await marketing.getById(scopeA, campaign.id);
    expect(detail?.recipients[0]?.status).toBe("blocked_consent");

    await marketing.recordConsent(scopeA, {
      customerId: customerA,
      status: "opted_in",
      source: "customer_form",
    });
  });

  test("CRUD, busca, detalhe e cancelamento permanecem tenant/store scoped", async () => {
    const marketing = createCampaignRepository(h.db);
    const campaign = await marketing.create(
      scopeA,
      campaignInput("Busca Phase14"),
      ids.users.storeA,
    );
    const updated = await marketing.update(
      scopeA,
      campaign.id,
      { ...campaignInput("Busca Atualizada"), content: "Novo conteúdo" },
      ids.users.storeA,
    );
    expect(updated?.name).toBe("Busca Atualizada");

    const page = await marketing.listPage(scopeA, {
      page: 1,
      pageSize: 1,
      search: "Busca Atualizada",
    });
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(await marketing.getById(scopeB, campaign.id)).toBeNull();

    const prepared = await marketing.prepare(scopeA, campaign.id);
    const recipientId = (await marketing.getById(scopeA, campaign.id))
      ?.recipients[0]?.id;
    expect(prepared).not.toBeNull();
    if (recipientId) {
      expect(await marketing.getRecipientById(scopeB, recipientId)).toBeNull();
    }
    expect(await marketing.cancel(scopeB, campaign.id)).toBeNull();
    expect((await marketing.cancel(scopeA, campaign.id))?.status).toBe("cancelled");
  });

  test("customer de outra loja não pode receber consentimento por UUID conhecido", async () => {
    const marketing = createCampaignRepository(h.db);
    await expectReject(
      marketing.recordConsent(scopeB, {
        customerId: customerA,
        status: "opted_in",
        source: "invalid_cross_store",
      }),
      "consentimento cross-store",
    );
  });

  test("audit não contém PII/conteúdo e não existem métricas fake", async () => {
    const marketing = createCampaignRepository(h.db);
    const campaign = await marketing.create(
      scopeA,
      {
        ...campaignInput("Audit sem PII"),
        content: "SEGREDO-CAMPANHA a@example.test 62914140001",
      },
      ids.users.storeA,
    );
    await marketing.prepare(scopeA, campaign.id, ids.users.storeA);
    const audits = await h.db.query(
      `select metadata::text as metadata from public.audit_logs
       where tenant_id=$1 and store_id=$2
         and resource_type='campaign' and resource_id=$3`,
      [scopeA.tenantId, scopeA.storeId, campaign.id],
    );
    const metadata = audits.map((row) => String(row["metadata"])).join(" ");
    expect(metadata).not.toContain("SEGREDO-CAMPANHA");
    expect(metadata).not.toContain("a@example.test");
    expect(metadata).not.toContain("62914140001");

    const columns = await h.db.query(
      `select column_name from information_schema.columns
       where table_schema='public'
         and table_name in ('marketing_campaigns','marketing_campaign_recipients')`,
    );
    const names = columns.map((row) => String(row["column_name"]));
    expect(names).not.toContain("delivered_at");
    expect(names).not.toContain("read_at");
    expect(names).not.toContain("clicked_at");
  });
});
