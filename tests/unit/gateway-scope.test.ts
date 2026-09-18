import { describe, expect, test } from "bun:test";
import {
  assertGatewayScope,
  controlTenantBillingScope,
} from "../../apps/web/src/lib/server/control-gateways.scope.server.ts";

describe("gateway financial scope", () => {
  test("contexto do /control sempre deriva tenant_billing no servidor", () => {
    const scope = controlTenantBillingScope("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(scope).toEqual({
      level: "tenant_billing",
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      storeId: null,
    });
  });

  test("níveis financeiros não aceitam owners incompatíveis", () => {
    expect(() => assertGatewayScope({
      level: "platform_billing",
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      storeId: null,
    })).toThrow();
    expect(() => assertGatewayScope({
      level: "tenant_billing",
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      storeId: "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa",
    })).toThrow();
    expect(() => assertGatewayScope({
      level: "store_checkout",
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      storeId: null,
    })).toThrow();
  });
});
