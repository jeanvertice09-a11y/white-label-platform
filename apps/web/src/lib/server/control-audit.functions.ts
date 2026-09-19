import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { controlMerchantRead } from "./control-merchants.shared.server.ts";
import { listControlAudit } from "./control-audit.read.server.ts";

const dateFilter = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]);
const schema = z.object({
  action: z.string().trim().max(120).default(""),
  actor: z.string().trim().max(120).default(""),
  store: z.string().trim().max(160).default(""),
  resource: z.string().trim().max(160).default(""),
  from: dateFilter.default(""),
  to: dateFilter.default(""),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(30),
});

export const getControlAuditWorkspace = createServerFn({ method: "GET" })
  .validator((input: Partial<z.infer<typeof schema>> | undefined) => schema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const ctx = await controlMerchantRead();
    return listControlAudit(ctx.sql, ctx.tenantId, data);
  });
