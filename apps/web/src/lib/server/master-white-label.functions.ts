import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createWhiteLabelDomain, setWhiteLabelDomainStatus, updateWhiteLabelDomain, changeWhiteLabelOwner, createWhiteLabel, setWhiteLabelStatus, updateWhiteLabel } from "./master-white-label.write.server.ts";
import { getWhiteLabelDetail, listWhiteLabels } from "./master-white-label.read.server.ts";
import { masterMutation, masterRead } from "./master-white-label.shared.server.ts";

const tenantIdSchema = z.object({ tenantId: z.string().uuid() });
const listSchema = z.object({ search: z.string().trim().max(120).default(""), status: z.enum(["all", "trial", "active", "suspended"]).default("all"), page: z.number().int().min(1).max(10000).default(1), pageSize: z.number().int().min(1).max(50).default(20) });
const createSchema = z.object({ name: z.string().trim().min(2).max(160), slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), ownerUserId: z.string().uuid() });
const updateSchema = z.object({ tenantId: z.string().uuid(), name: z.string().trim().min(2).max(160), slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), logoUrl: z.string().trim().url().max(2048).nullable(), primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).nullable(), settings: z.record(z.unknown()) });
const ownerSchema = z.object({ tenantId: z.string().uuid(), ownerUserId: z.string().uuid() });
const statusSchema = z.object({ tenantId: z.string().uuid(), status: z.enum(["active", "suspended"]) });
const domainTypeSchema = z.enum(["tenant_panel", "tenant_site", "store_admin", "store_catalog"]);
const domainSchema = z.object({ tenantId: z.string().uuid(), hostname: z.string().trim().min(1).max(253), type: domainTypeSchema, storeId: z.string().uuid().nullable() });
const updateDomainSchema = domainSchema.extend({ domainId: z.string().uuid() });
const domainStatusSchema = z.object({ tenantId: z.string().uuid(), domainId: z.string().uuid(), status: z.enum(["pending", "suspended"]) });

export const listMasterWhiteLabels = createServerFn({ method: "GET" }).validator((input: Partial<z.infer<typeof listSchema>> | undefined) => listSchema.parse(input ?? {})).handler(async ({ data }) => listWhiteLabels((await masterRead()).sql, data));
export const getMasterWhiteLabel = createServerFn({ method: "GET" }).validator(tenantIdSchema).handler(async ({ data }) => getWhiteLabelDetail((await masterRead()).sql, data.tenantId));
export const createMasterWhiteLabel = createServerFn({ method: "POST" }).validator(createSchema).handler(async ({ data }) => { const c = await masterMutation(); return createWhiteLabel(c.sql, c.actorUserId, data); });
export const updateMasterWhiteLabel = createServerFn({ method: "POST" }).validator(updateSchema).handler(async ({ data }) => { const c = await masterMutation(); return updateWhiteLabel(c.sql, c.actorUserId, data); });
export const changeMasterWhiteLabelOwner = createServerFn({ method: "POST" }).validator(ownerSchema).handler(async ({ data }) => { const c = await masterMutation(); return changeWhiteLabelOwner(c.sql, c.actorUserId, data.tenantId, data.ownerUserId); });
export const setMasterWhiteLabelStatus = createServerFn({ method: "POST" }).validator(statusSchema).handler(async ({ data }) => { const c = await masterMutation(); return setWhiteLabelStatus(c.sql, c.actorUserId, data.tenantId, data.status); });
export const createMasterDomain = createServerFn({ method: "POST" }).validator(domainSchema).handler(async ({ data }) => { const c = await masterMutation(); return createWhiteLabelDomain(c.sql, c.actorUserId, data); });
export const updateMasterDomain = createServerFn({ method: "POST" }).validator(updateDomainSchema).handler(async ({ data }) => { const c = await masterMutation(); return updateWhiteLabelDomain(c.sql, c.actorUserId, data); });
export const setMasterDomainStatus = createServerFn({ method: "POST" }).validator(domainStatusSchema).handler(async ({ data }) => { const c = await masterMutation(); return setWhiteLabelDomainStatus(c.sql, c.actorUserId, data.tenantId, data.domainId, data.status); });
