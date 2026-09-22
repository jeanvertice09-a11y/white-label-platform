import { createServerFn } from "@tanstack/react-start";
import { invalidateDomainCache } from "@white-label/domains";
import { z } from "zod";
import { controlMerchantMutation, controlMerchantRead } from "./control-merchants.shared.server.ts";
import { createConfiguredDomainProvider } from "./domain-provider.server.ts";
import { getDomainCache } from "./domain-cache.server.ts";
import { loadControlDomainWorkspace } from "./control-domains.read.server.ts";
import { createControlDomain, deleteControlDomain, setControlDomainStatus, updateControlDomain } from "./control-domains.write.server.ts";
import { verifyControlDomain } from "./control-domains.verify.server.ts";
import { createConfiguredVercelDomainProvisioner } from "./vercel-domain-provisioner.server.ts";

const domainTypeSchema = z.enum(["tenant_panel", "tenant_site", "store_admin", "store_catalog"]);
const domainInputSchema = z.object({
  hostname: z.string().trim().min(1).max(512),
  type: domainTypeSchema,
  storeId: z.string().uuid().nullable(),
});
const domainUpdateSchema = domainInputSchema.extend({ domainId: z.string().uuid() });
const domainIdSchema = z.object({ domainId: z.string().uuid() });
const domainStatusSchema = domainIdSchema.extend({ status: z.enum(["pending", "suspended"]) });

interface DomainLookupSql {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

async function domainHostname(sql: DomainLookupSql, tenantId: string, domainId: string): Promise<string | null> {
  const rows = await sql.query(
    "select hostname from public.domains where tenant_id=$1::uuid and id=$2::uuid limit 1",
    [tenantId, domainId],
  );
  return typeof rows[0]?.["hostname"] === "string" ? rows[0]["hostname"] : null;
}

async function invalidateHostname(hostname: string | null): Promise<void> {
  if (hostname) await invalidateDomainCache(getDomainCache(), hostname);
}

export const getControlDomainWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await controlMerchantRead();
  return loadControlDomainWorkspace(ctx.sql, ctx.tenantId, createConfiguredDomainProvider(), ctx.canManageTenantStores);
});

export const createControlDomainAction = createServerFn({ method: "POST" })
  .validator(domainInputSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return createControlDomain(ctx.sql, ctx.tenantId, ctx.actorUserId, data, createConfiguredVercelDomainProvisioner());
  });

export const updateControlDomainAction = createServerFn({ method: "POST" })
  .validator(domainUpdateSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    const previous = await domainHostname(ctx.sql, ctx.tenantId, data.domainId);
    const result = await updateControlDomain(ctx.sql, ctx.tenantId, ctx.actorUserId, data, createConfiguredVercelDomainProvisioner());
    await invalidateHostname(previous);
    await invalidateHostname(data.hostname);
    return result;
  });

export const verifyControlDomainAction = createServerFn({ method: "POST" })
  .validator(domainIdSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    const hostname = await domainHostname(ctx.sql, ctx.tenantId, data.domainId);
    const result = await verifyControlDomain(ctx.sql, ctx.tenantId, ctx.actorUserId, data.domainId, createConfiguredDomainProvider());
    await invalidateHostname(hostname);
    return result;
  });

export const setControlDomainStatusAction = createServerFn({ method: "POST" })
  .validator(domainStatusSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    const hostname = await domainHostname(ctx.sql, ctx.tenantId, data.domainId);
    const result = await setControlDomainStatus(ctx.sql, ctx.tenantId, ctx.actorUserId, data.domainId, data.status, createConfiguredVercelDomainProvisioner());
    await invalidateHostname(hostname);
    return result;
  });

export const deleteControlDomainAction = createServerFn({ method: "POST" })
  .validator(domainIdSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    const hostname = await domainHostname(ctx.sql, ctx.tenantId, data.domainId);
    const result = await deleteControlDomain(ctx.sql, ctx.tenantId, ctx.actorUserId, data.domainId);
    await invalidateHostname(hostname);
    return result;
  });
