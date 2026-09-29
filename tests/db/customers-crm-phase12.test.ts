import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createCustomerRepository } from "../../packages/customers/src/index.ts";
import { createOrderRepository } from "../../packages/orders/src/index.ts";
import { setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const PRODUCT = "f1200000-0000-4000-8000-000000000001";
const scopeA = { tenantId: ids.tenantA, storeId: ids.storeA };
const scopeB = { tenantId: ids.tenantB, storeId: ids.storeB };

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
  await h.db.execScript(`
    insert into public.products
      (id,tenant_id,store_id,slug,name,price_cents,active)
    values (
      '${PRODUCT}','${ids.tenantA}','${ids.storeA}',
      'crm-phase12','Produto CRM',2500,true
    );
  `);
});

afterAll(async () => {
  await h.db.close();
});

function cartInput(key: string, phone = "62999991111") {
  return {
    idempotencyKey: key,
    origin: "whatsapp" as const,
    customerName: "Cliente Checkout",
    customerPhone: phone,
    notes: null,
    shippingCents: 0,
    items: [{ productId: PRODUCT, variantId: null, quantity: 1 }],
  };
}

describe("phase 12 customers CRM", () => {
  test("checkout cria/associa customer e retry não duplica order/customer", async () => {
    const customers = createCustomerRepository(h.db);
    const orders = createOrderRepository(h.db);

    const first = await orders.createFromCart(scopeA, cartInput("phase12-retry"));
    const retry = await orders.createFromCart(scopeA, cartInput("phase12-retry"));

    expect(first.id).toBe(retry.id);
    expect(first.customerId).not.toBeNull();
    expect(retry.customerId).toBe(first.customerId);

    const rows = await h.db.query(
      `select count(*)::integer as total from public.customers
       where tenant_id=$1 and store_id=$2 and phone=$3`,
      [scopeA.tenantId, scopeA.storeId, "62999991111"],
    );
    expect(Number(rows[0]?.["total"])).toBe(1);

    const customer = await customers.getById(scopeA, String(first.customerId));
    expect(customer?.totalOrders).toBe(1);
    expect(customer?.orders[0]?.paymentStatus).toBe("pending");
    expect(customer?.orders[0]?.itemSummary).toContain("Produto CRM");
  });

  test("segundo pedido usa o mesmo customer e atualiza histórico/métricas reais", async () => {
    const customers = createCustomerRepository(h.db);
    const orders = createOrderRepository(h.db);

    const first = await orders.createFromCart(
      scopeA,
      cartInput("phase12-history-1", "62999992222"),
    );
    const second = await orders.createFromCart(
      scopeA,
      cartInput("phase12-history-2", "62999992222"),
    );
    expect(second.customerId).toBe(first.customerId);

    await h.db.query(
      `update public.orders
       set status='completed',payment_status='paid',completed_at=now()
       where tenant_id=$1 and store_id=$2 and id=any($3::uuid[])`,
      [scopeA.tenantId, scopeA.storeId, [first.id, second.id]],
    );

    const detail = await customers.getById(scopeA, String(first.customerId));
    expect(detail?.totalOrders).toBe(2);
    expect(detail?.orderCount).toBe(2);
    expect(detail?.totalSpentCents).toBe(5000);
    expect(detail?.lastOrderAt).not.toBeNull();
    expect(detail?.orders.map((order) => order.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });

  test("identificação concorrente pela mesma store não duplica customer", async () => {
    const orders = createOrderRepository(h.db);
    const [a, b] = await Promise.all([
      orders.createFromCart(
        scopeA,
        cartInput("phase12-race-a", "62999993333"),
      ),
      orders.createFromCart(
        scopeA,
        cartInput("phase12-race-b", "62999993333"),
      ),
    ]);
    expect(a.customerId).toBe(b.customerId);

    const rows = await h.db.query(
      `select count(*)::integer as total from public.customers
       where tenant_id=$1 and store_id=$2 and phone=$3`,
      [scopeA.tenantId, scopeA.storeId, "62999993333"],
    );
    expect(Number(rows[0]?.["total"])).toBe(1);
  });

  test("busca e paginação são tenant/store scoped com métricas na lista", async () => {
    const customers = createCustomerRepository(h.db);
    await customers.create(scopeA, {
      name: "Busca Alfa",
      phone: "62988881111",
      email: "alfa@example.test",
      document: "DOC-A",
      birthDate: null,
      notes: null,
    });
    await customers.create(scopeA, {
      name: "Busca Beta",
      phone: "62988882222",
      email: "beta@example.test",
      document: "DOC-B",
      birthDate: null,
      notes: null,
    });

    const page = await customers.listPage(scopeA, {
      page: 1,
      pageSize: 1,
      search: "Busca",
    });
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);

    const byDocument = await customers.listPage(scopeA, {
      page: 1,
      pageSize: 20,
      search: "DOC-B",
    });
    expect(byDocument.items.map((item) => item.name)).toEqual(["Busca Beta"]);

    const otherStore = await customers.listPage(scopeB, {
      page: 1,
      pageSize: 20,
      search: "Busca",
    });
    expect(otherStore.items).toHaveLength(0);
  });

  test("UUID conhecido não rompe IDOR de customer nem order/history", async () => {
    const customers = createCustomerRepository(h.db);
    const orders = createOrderRepository(h.db);
    const order = await orders.createFromCart(
      scopeA,
      cartInput("phase12-idor", "62999994444"),
    );
    expect(order.customerId).not.toBeNull();

    expect(
      await customers.getById(scopeB, String(order.customerId)),
    ).toBeNull();
    expect(await orders.getById(scopeB, order.id)).toBeNull();

    const detailB = await customers.getById(scopeB, String(order.customerId));
    expect(detailB).toBeNull();
  });

  test("mutações administrativas preservam scope e auditam sem PII", async () => {
    const customers = createCustomerRepository(h.db);
    const customer = await customers.create(
      scopeA,
      {
        name: "Cliente Auditável",
        phone: "62977771111",
        email: "audit@example.test",
        document: "DOC-SECRET",
        birthDate: null,
        notes: "nota privada",
      },
      ids.users.storeA,
    );

    const crossStoreUpdate = await customers.update(
      scopeB,
      customer.id,
      {
        name: "Tentativa B",
        phone: "62977772222",
        email: null,
        document: null,
        birthDate: null,
        notes: null,
      },
      ids.users.storeB,
    );
    expect(crossStoreUpdate).toBeNull();

    const updated = await customers.update(
      scopeA,
      customer.id,
      {
        name: "Cliente Atualizado",
        phone: "62977771111",
        email: "novo@example.test",
        document: null,
        birthDate: null,
        notes: null,
      },
      ids.users.storeA,
    );
    expect(updated?.storeId).toBe(scopeA.storeId);
    expect(updated?.tenantId).toBe(scopeA.tenantId);

    const audit = await h.db.query(
      `select action,metadata::text as metadata
       from public.audit_logs
       where tenant_id=$1 and store_id=$2
         and resource_type='customer' and resource_id=$3
       order by created_at`,
      [scopeA.tenantId, scopeA.storeId, customer.id],
    );
    expect(audit.map((row) => row["action"])).toEqual([
      "customer.created",
      "customer.updated",
    ]);
    const metadata = audit.map((row) => String(row["metadata"])).join(" ");
    expect(metadata).not.toContain("audit@example.test");
    expect(metadata).not.toContain("DOC-SECRET");
    expect(metadata).not.toContain("nota privada");
  });

  test("checkout não cria consentimento de marketing inexistente no modelo", async () => {
    const orders = createOrderRepository(h.db);
    const order = await orders.createFromCart(
      scopeA,
      cartInput("phase12-no-optin", "62999995555"),
    );
    const rows = await h.db.query(
      `select email,notes from public.customers
       where tenant_id=$1 and store_id=$2 and id=$3`,
      [scopeA.tenantId, scopeA.storeId, order.customerId],
    );
    expect(rows[0]?.["email"]).toBeNull();
    expect(rows[0]?.["notes"]).toBeNull();
  });
});
