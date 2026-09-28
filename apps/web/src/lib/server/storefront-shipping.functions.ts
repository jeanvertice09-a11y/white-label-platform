import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { createPublicCatalogContext } from "./catalog-context.server.ts";

const item = z.object({ productId: z.string().uuid(), variantId: z.string().uuid().nullable(), quantity: z.number().int().min(1).max(999) });
const address = z.object({
  postalCode: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length === 8),
  name: z.string().min(2).max(160), phone: z.string().min(8).max(30), email: z.string().email(),
  document: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length === 11 || v.length === 14),
  address: z.string().min(2), number: z.string().min(1), complement: z.string().nullable(),
  district: z.string().min(2), city: z.string().min(2), stateAbbr: z.string().length(2),
});
const quoteSchema = z.object({
  items: z.array(item).min(1).max(100),
  destinationPostalCode: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length === 8),
});


export const quotePublicShipping = createServerFn({ method: "POST" })
  .validator(quoteSchema)
  .handler(async ({ data }) => {
    const context = await createPublicCatalogContext(getRequestHost());
    const { calculatePublicShippingQuotes } = await import("./storefront-shipping.server.ts");
    return calculatePublicShippingQuotes(context.scope, data.items, data.destinationPostalCode);
  });

export { address as shippingAddressSchema };
