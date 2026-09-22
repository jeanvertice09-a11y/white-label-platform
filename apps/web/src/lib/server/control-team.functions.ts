import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { controlTeamMutation, controlTeamRead } from "./control-team.shared.server.ts";
import { loadControlTeamWorkspace } from "./control-team.read.server.ts";
import {
  removeStoreMember,
  removeTenantMember,
  upsertStoreMember,
  upsertTenantMember,
} from "./control-team.write.server.ts";

const tenantRoleSchema = z.enum([
  "tenant_owner",
  "tenant_admin",
  "tenant_finance",
  "tenant_support",
]);
const managedStoreRoleSchema = z.enum(["store_admin", "store_manager", "store_staff"]);
const emailSchema = z.string().trim().email().max(320);

export const getControlTeamWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await controlTeamRead();
  return loadControlTeamWorkspace(ctx.sql, ctx.tenantId, ctx.canManage, ctx.actorIsOwner);
});

export const saveTenantMemberAction = createServerFn({ method: "POST" })
  .validator(z.object({ email: emailSchema, role: tenantRoleSchema }))
  .handler(async ({ data }) => {
    const ctx = await controlTeamMutation();
    return upsertTenantMember(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      ctx.actorIsOwner,
      data.email,
      data.role,
    );
  });

export const removeTenantMemberAction = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const ctx = await controlTeamMutation();
    return removeTenantMember(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      ctx.actorIsOwner,
      data.userId,
    );
  });

export const saveStoreMemberAction = createServerFn({ method: "POST" })
  .validator(z.object({
    storeId: z.string().uuid(),
    email: emailSchema,
    role: managedStoreRoleSchema,
  }))
  .handler(async ({ data }) => {
    const ctx = await controlTeamMutation();
    return upsertStoreMember(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      data.storeId,
      data.email,
      data.role,
    );
  });

export const removeStoreMemberAction = createServerFn({ method: "POST" })
  .validator(z.object({ storeId: z.string().uuid(), userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const ctx = await controlTeamMutation();
    return removeStoreMember(
      ctx.sql,
      ctx.tenantId,
      ctx.actorUserId,
      data.storeId,
      data.userId,
    );
  });
