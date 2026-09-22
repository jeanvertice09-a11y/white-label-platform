import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createCustomerRepository } from "../../packages/customers/src/index.ts";
import { createOrderRepository } from "../../packages/orders/src/index.ts";
import { createCampaignRepository } from "../../packages/marketing/src/index.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const scopeA = { tenantId: ids.tenantA, storeId: ids.storeA };
const scopeB = { tenantId: ids.tenantB, storeId: ids.storeB };
const PRODUCT = "f1400000-0000-4000-8000-000000000002";
let customerOptIn = "";
let customerNoOptIn = "";

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.products
      (id,tenant_id,store_id,slug,name,price_cents,active)
    values ('${PRODUCT}','${ids.tenantA}','${ids.storeA}',
      'phase14-hardening-product','Produto Phase 14 Hardening',3000,true);
  `);

  const customers = createCustomerRepository(h.db);
  const optedIn = await customers.create(scopeA, {
    name: "Customer Hardening Opt-in",
    phone: "62914140101",
    email: "hardening-a@example.test",
    document: null,
    birthDate: null,
    notes: null,
  });
  const noOptIn = await customers.create(scopeA, {
    name: "Customer Hardening Sem Opt-in",
    phone: "62914140102",
    email: "hardening-b@example.test",
    document: null,
    birthDate: null,
    notes: null,
  });
  customerOptIn = optedIn.id;
  customerNoOptIn = noOptIn.id;

  const marketing = createCampaignRepository(h.db);
  await marketing.recordConsent(scopeA, {
    customerId: customerOptIn,
    status: "opted_in",
    source: "customer_form",
  });

  const orders = createOrderRepository(h.db);
  await orders.createFromCart(scopeA, {
    idempotencyKey: "phase14-hardening-order-a",
    origin: "whatsapp",
    customerName: "Customer Hardening Opt-in",
    customerPhone: "62914140101",
    notes: null,
    shippingCents: 0,
    items: [{ productId: PRODUCT, variantId: null, quantity: 1 }],
  });
  await orders.createFromCart(scopeA, {
    idempotencyKey: "phase14-hardening-order-b",
    origin: "whatsapp",
    customerName: "Customer Hardening Sem Opt-in",
    customerPhone: "62914140102",
    notes: null,
    shippingCents: 0,
    items: [{ productId: PRODUCT, variantId: null, quantity: 1 }],
  });
});

afterAll(async () => {
  await h.db.close();
});

describe("phase 14 marketing hardening", () => {
  test("compra sem opt-in não cria consentimento nem recipient", async () => {
    const consentRows = await h.db.query(
      `select id from public.marketing_consents
       where tenant_id=$1 and store_id=$2 and customer_id=$3`,
      [scopeA.tenantId, scopeA.storeId, customerNoOptIn],
    );
    expect(consentRows).toHaveLength(0);

    const marketing = createCampaignRepository(h.db);
    const campaign = await marketing.create(scopeA, {
      name: "Compra não autoriza hardening",
      content: "Conteúdo seguro",
      segmentType: "with_orders",
      scheduledAt: null,
    });
    await marketing.prepare(scopeA, campaign.id);
    const detail = await marketing.getById(scopeA, campaign.id);
    const customerIds = detail?.recipients.map((item) => item.customerId) ?? [];
    expect(customerIds).toContain(customerOptIn);
    expect(customerIds).not.toContain(customerNoOptIn);
  });

  test("recipient conhecido não atravessa tenant/store por IDOR", async () => {
    const marketing = createCampaignRepository(h.db);
    const campaign = await marketing.create(scopeA, {
      name: "Recipient IDOR hardening",
      content: "Conteúdo seguro",
      segmentType: "all",
      scheduledAt: null,
    });
    await marketing.prepare(scopeA, campaign.id);
    const detail = await marketing.getById(scopeA, campaign.id);
    const recipientId = detail?.recipients[0]?.id;
    if (!recipientId) throw new Error("Recipient esperado para teste IDOR");

    expect(await marketing.getRecipientById(scopeB, recipientId)).toBeNull();
  });
});
