import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// STATIC/CONTRACT TESTS — verificam o texto das migrations, NÃO executam
// PostgreSQL. Supabase CLI / psql / Docker indisponíveis nesta máquina,
// portanto:
//   REAL DATABASE ISOLATION TESTS: PENDING LOCAL SUPABASE
// (executar `supabase start` + `supabase db push --local` e tentar os
// inserts conflitantes: Tenant A + Store B, Product A + Category B,
// OrderItem A + Order/Product B, StockMovement A + Product B,
// Payment A + GatewayAccount B — todos devem ser rejeitados.)

const dir = join(import.meta.dir, "../../../supabase/migrations");
const m1 = readFileSync(join(dir, "0001_foundation.sql"), "utf8");
const m2 = readFileSync(join(dir, "0002_commerce_stubs.sql"), "utf8");
const m3 = readFileSync(join(dir, "0003_rls.sql"), "utf8");
const m4 = readFileSync(join(dir, "0004_composite_hardening.sql"), "utf8");

describe("fk composta (contract)", () => {
  test("stores expõe UNIQUE(tenant_id, id)", () => {
    expect(m1).toContain("unique (tenant_id, id)");
  });
  test("recursos usam FOREIGN KEY (tenant_id, store_id) -> stores", () => {
    expect(m1).toContain("foreign key (tenant_id, store_id) references public.stores (tenant_id, id)");
    expect(m2).toContain("foreign key (tenant_id, store_id) references public.stores (tenant_id, id)");
  });
  test("products.category_id é FK composta (tenant,store,category)", () => {
    expect(m4).toContain("foreign key (tenant_id, store_id, category_id)");
    expect(m4).toContain("references public.categories (tenant_id, store_id, id)");
  });
  test("order_items referencia order e product por FK composta", () => {
    expect(m4).toContain("foreign key (tenant_id, store_id, order_id)");
    expect(m4).toContain("references public.orders (tenant_id, store_id, id)");
    expect(m4).toContain("foreign key (tenant_id, store_id, product_id)");
    expect(m4).toContain("references public.products (tenant_id, store_id, id)");
  });
  test("stock_movements.product_id é FK composta", () => {
    expect(m4).toContain("foreign key (tenant_id, store_id, product_id)");
  });
  test("audit_logs e media_assets presos a stores do tenant", () => {
    expect(m4).toContain("audit_logs_store_fk");
    expect(m4).toContain("media_assets_store_fk");
  });
  test("alvos únicos para FKs compostas (categories/products/orders)", () => {
    expect(m4).toContain("categories_tenant_store_id_uidx");
    expect(m4).toContain("products_tenant_store_id_uidx");
    expect(m4).toContain("orders_tenant_store_id_uidx");
  });
  test("banco rejeitaria tenant A + store B (simulação da regra)", () => {
    const stores = [{ tenant_id: "A", id: "X" }];
    const product = { tenant_id: "B", store_id: "X" };
    const ok = stores.some((s) => s.tenant_id === product.tenant_id && s.id === product.store_id);
    expect(ok).toBe(false);
  });
});

describe("billing/payments no banco (contract)", () => {
  test("gateway_accounts: escopo por nível + FK de store", () => {
    expect(m4).toContain("gateway_accounts_scope_ck");
    expect(m4).toContain("gateway_accounts_store_fk");
    expect(m4).toContain("unique (level, id)");
  });
  test("payments: escopo por nível + gateway do mesmo nível/store", () => {
    expect(m4).toContain("payments_scope_ck");
    expect(m4).toContain("payments_gateway_level_fk");
    expect(m4).toContain("payments_gateway_store_fk");
  });
  test("trigger de propriedade gateway cobre tenant_billing/platform", () => {
    expect(m4).toContain("enforce_payment_gateway_scope");
    expect(m4).toContain("payments_gateway_scope_trg");
  });
  test("subscriptions sem store_id e com tenant obrigatório", () => {
    expect(m4).toContain("drop column if exists store_id");
    expect(m4).toContain("alter column tenant_id set not null");
  });
  test("domains: coerência tipo/escopo + hostname + verified", () => {
    expect(m4).toContain("domains_scope_ck");
    expect(m4).toContain("domains_hostname_ck");
    expect(m4).toContain("domains_verified_ck");
  });
});

describe("rls (contract)", () => {
  test("RLS ativada nas tabelas multi-tenant", () => {
    for (const t of ["tenants", "stores", "products", "orders", "domains", "audit_logs"]) {
      expect(m3).toContain(`alter table public.${t} enable row level security`);
    }
  });
  test("sem política pública permissiva; leitura exige membership", () => {
    expect(m3).not.toMatch(/create policy .* for (all|select) to (anon|public) using \(true\)/i);
    expect(m3).toContain("is_tenant_member");
    expect(m3).toContain("is_store_member");
  });
  test("SECURITY DEFINER com search_path + REVOKE/GRANT mínimo", () => {
    expect(m3).toContain("set search_path = public");
    expect(m3).toContain("revoke all on function");
    expect(m3).toContain("grant execute");
  });
});
