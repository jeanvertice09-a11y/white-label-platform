import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  listPlatformPlanTemplates,
  replacePlatformTemplateEntitlements,
} from "@white-label/billing";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { createRealDeps, loadMaster } from "./route-context.server.ts";

const entitlementSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  kind: z.enum(["feature", "limit"]),
  enabled: z.boolean().nullable(),
  limitValue: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
});
const replaceSchema = z.object({
  templateId: z.string().uuid(),
  values: z.array(entitlementSchema).max(200),
});

async function masterSql() {
  const deps = await createRealDeps();
  await loadMaster({ host: getRequestHost() }, deps);
  return createAdminSqlExecutor();
}

export const getPlatformPlanTemplates = createServerFn({ method: "GET" }).handler(async () => {
  return listPlatformPlanTemplates(await masterSql());
});

export const savePlatformTemplateEntitlements = createServerFn({ method: "POST" })
  .validator(replaceSchema)
  .handler(async ({ data }) => {
    await replacePlatformTemplateEntitlements(
      await masterSql(),
      data.templateId,
      data.values,
    );
    return { ok: true };
  });
