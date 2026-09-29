import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { masterRead } from "./master-white-label.shared.server.ts";
import { listMasterAudit } from "./master-audit.read.server.ts";

const dateFilter = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]);
const schema = z.object({
  action: z.string().trim().max(120).default(""),
  actor: z.string().trim().max(120).default(""),
  tenant: z.string().trim().max(160).default(""),
  store: z.string().trim().max(160).default(""),
  resource: z.string().trim().max(160).default(""),
  from: dateFilter.default(""),
  to: dateFilter.default(""),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(30),
});

export const listMasterAuditAction = createServerFn({ method: "GET" })
  .validator((input: Partial<z.infer<typeof schema>> | undefined) => schema.parse(input ?? {}))
  .handler(async ({ data }) => listMasterAudit((await masterRead()).sql, data));
