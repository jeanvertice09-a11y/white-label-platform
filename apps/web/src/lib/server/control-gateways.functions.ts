import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createCredentialVaultFromEnv } from "@white-label/payments/server";
import { controlGatewayMutation, controlGatewayRead } from "./control-gateways.shared.server.ts";
import { loadControlGatewayWorkspace } from "./control-gateways.read.server.ts";
import {
  createGatewayAccount,
  setGatewayAccountStatus,
  updateGatewayAccount,
} from "./control-gateways.write.server.ts";
import { controlTenantBillingScope } from "./control-gateways.scope.server.ts";

const providerSchema = z.enum(["mercadopago", "asaas"]);
const safeText = z.string().max(16_384);
const publicIdentifier = z.string().trim().max(255).nullable();

const createSchema = z.object({
  provider: providerSchema,
  label: z.string().trim().min(1).max(120),
  publicIdentifier,
  credentials: safeText,
  webhookSecret: safeText,
});

const updateSchema = z.object({
  gatewayAccountId: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
  publicIdentifier,
  credentials: safeText,
  webhookSecret: safeText,
});

const statusSchema = z.object({
  gatewayAccountId: z.string().uuid(),
  status: z.enum(["active", "disabled"]),
});

export const getControlGatewayWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await controlGatewayRead();
  return loadControlGatewayWorkspace(ctx.sql, ctx.tenantId, ctx.canManage);
});

export const createControlGatewayAccount = createServerFn({ method: "POST" })
  .validator(createSchema)
  .handler(async ({ data }) => {
    const ctx = await controlGatewayMutation();
    return createGatewayAccount(
      ctx.sql,
      createCredentialVaultFromEnv(),
      ctx.actorUserId,
      controlTenantBillingScope(ctx.tenantId),
      data,
    );
  });

export const updateControlGatewayAccount = createServerFn({ method: "POST" })
  .validator(updateSchema)
  .handler(async ({ data }) => {
    const ctx = await controlGatewayMutation();
    return updateGatewayAccount(
      ctx.sql,
      createCredentialVaultFromEnv(),
      ctx.actorUserId,
      controlTenantBillingScope(ctx.tenantId),
      data,
    );
  });

export const setControlGatewayAccountStatus = createServerFn({ method: "POST" })
  .validator(statusSchema)
  .handler(async ({ data }) => {
    const ctx = await controlGatewayMutation();
    return setGatewayAccountStatus(
      ctx.sql,
      ctx.actorUserId,
      controlTenantBillingScope(ctx.tenantId),
      data.gatewayAccountId,
      data.status,
    );
  });
