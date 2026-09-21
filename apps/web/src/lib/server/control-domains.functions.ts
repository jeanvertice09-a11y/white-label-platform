import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { controlMerchantMutation, controlMerchantRead } from "./control-merchants.shared.server.ts";
import { createConfiguredDomainProvider } from "./domain-provider.server.ts";
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

export const getControlDomainWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await controlMerchantRead();
  return loadControlDomainWorkspace(
    ctx.sql,
    ctx.tenantId,
    createConfiguredDomainProvider(),
    ctx.canManageTenantStores,
  );
});

export const createControlDomainAction = createServerFn({ method: "POST" })
  .validator(domainInputSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return createControlDomain(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      data,
      createConfiguredVercelDomainProvisioner(),
    );
  });

export const updateControlDomainAction = createServerFn({ method: "POST" })
  .validator(domainUpdateSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return updateControlDomain(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      data,
      createConfiguredVercelDomainProvisioner(),
    );
  });

export const verifyControlDomainAction = createServerFn({ method: "POST" })
  .validator(domainIdSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return verifyControlDomain(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      data.domainId,
      createConfiguredDomainProvider(),
    );
  });

export const setControlDomainStatusAction = createServerFn({ method: "POST" })
  .validator(domainStatusSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return setControlDomainStatus(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      data.domainId,
      data.status,
      createConfiguredVercelDomainProvisioner(),
    );
  });

export const deleteControlDomainAction = createServerFn({ method: "POST" })
  .validator(domainIdSchema)
  .handler(async ({ data }) => {
    const ctx = await controlMerchantMutation();
    return deleteControlDomain(ctx.sql, ctx.tenantId, ctx.actorUserId, data.domainId);
  });
