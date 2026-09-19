import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { controlMerchantMutation } from "./control-merchants.shared.server.ts";
import { updateControlBranding } from "./control-branding.write.server.ts";

const nullableUrl = z.union([z.string().trim().url().max(2048), z.literal("")])
  .transform((value) => value || null);
const nullableHex = z.union([z.string().trim().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")])
  .transform((value) => value || null);

const brandingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  logoUrl: nullableUrl,
  primaryColor: nullableHex,
});

export const updateControlBrandingAction = createServerFn({ method: "POST" })
  .validator(brandingSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return updateControlBranding(ctx.sql, ctx.tenantId, ctx.actorUserId, data);
  });
