import type { CatalogScope } from "@white-label/catalog";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { melhorEnvioRequest } from "./melhor-envio.server.ts";
import { verifyShippingSelection } from "./shipping-selection.ts";

interface QuoteItem { productId: string; variantId: string | null; quantity: number; }
export interface ShippingQuote {
  serviceId: number; serviceName: string; companyName: string;
  priceCents: number; deliveryDays: number; snapshot: string;
}

/** Requotes against the store's origin and current product data, never client prices. */
export async function calculatePublicShippingQuotes(
  scope: CatalogScope, items: QuoteItem[], destinationPostalCode: string,
): Promise<ShippingQuote[]> {
  const db = createAdminSqlExecutor();
  const originRows = await db.query(
    `select postal_code from public.store_shipping_profiles
     where tenant_id=$1::uuid and store_id=$2::uuid and enabled=true`,
    [scope.tenantId, scope.storeId],
  );
  if (originRows.length === 0) throw new Error("Frete não disponível.");
  const origin = originRows[0];
  const rows = await db.query(
    `select id::text,price_cents,shipping_weight_kg,shipping_width_cm,
            shipping_height_cm,shipping_length_cm from public.products
     where tenant_id=$1::uuid and store_id=$2::uuid and id=any($3::uuid[]) and active=true`,
    [scope.tenantId, scope.storeId, items.map((value) => value.productId)],
  );
  const byId = new Map(rows.map((row) => [String(row["id"]), row]));
  const products = items.map((value, index) => {
    const product = byId.get(value.productId);
    if (!product?.["shipping_weight_kg"]) throw new Error("Produto sem peso/dimensões para cálculo de frete.");
    return {
      id: String(index + 1), width: Number(product["shipping_width_cm"]),
      height: Number(product["shipping_height_cm"]), length: Number(product["shipping_length_cm"]),
      weight: Number(product["shipping_weight_kg"]), insurance_value: Number(product["price_cents"]) / 100,
      quantity: value.quantity,
    };
  });
  const result: unknown = await melhorEnvioRequest(scope, "/api/v2/me/shipment/calculate", {
    method: "POST",
    body: JSON.stringify({ from: { postal_code: origin["postal_code"] }, to: { postal_code: destinationPostalCode }, products }),
  });
  if (!Array.isArray(result)) throw new Error("Cotação de frete indisponível.");
  return result.flatMap((value: unknown): ShippingQuote[] => {
    if (typeof value !== "object" || value === null) return [];
    const quote = value as Record<string, unknown>;
    const priceCents = Math.round(Number(quote["custom_price"] ?? quote["price"]) * 100);
    const serviceId = Number(quote["id"]);
    if (quote["error"] || !Number.isSafeInteger(priceCents) || priceCents < 0 ||
        !Number.isSafeInteger(serviceId) || serviceId <= 0) return [];
    const company = quote["company"];
    const rawCompanyName = typeof company === "object" && company !== null
      ? (company as Record<string, unknown>)["name"] : null;
    const companyName = typeof rawCompanyName === "string" ? rawCompanyName : "";
    const serviceName = typeof quote["name"] === "string" ? quote["name"] : "Frete";
    return [{
      serviceId, serviceName, companyName, priceCents,
      deliveryDays: Number(quote["custom_delivery_time"] ?? quote["delivery_time"] ?? 0),
      snapshot: JSON.stringify(quote),
    }];
  });
}


export async function resolveCheckoutShipping(
  scope: CatalogScope,
  items: QuoteItem[],
  shipping: { serviceId: number; priceCents: number; recipient: { postalCode: string } } | null,
  deps: {
    isEnabled: (scope: CatalogScope) => Promise<boolean>;
    quote: typeof calculatePublicShippingQuotes;
  } = { isEnabled: isStoreShippingEnabled, quote: calculatePublicShippingQuotes },
): Promise<ShippingQuote | null> {
  if (!shipping) {
    if (await deps.isEnabled(scope)) throw new Error("Calcule o frete e selecione uma entrega antes de pagar.");
    return null;
  }
  return verifyShippingSelection(
    await deps.quote(scope, items, shipping.recipient.postalCode),
    shipping.serviceId,
    shipping.priceCents,
  );
}

async function isStoreShippingEnabled(scope: CatalogScope): Promise<boolean> {
  const rows = await createAdminSqlExecutor().query(
    `select 1 from public.store_shipping_profiles
     where tenant_id=$1::uuid and store_id=$2::uuid and enabled=true`,
    [scope.tenantId, scope.storeId],
  );
  return rows.length > 0;
}
