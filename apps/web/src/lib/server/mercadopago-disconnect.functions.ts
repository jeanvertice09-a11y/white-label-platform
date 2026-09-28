import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createMerchantCatalogContext } from "./catalog-context.server.ts";
import { createAdminSqlExecutor } from "./supabase-admin.server.ts";
import { resolveSessionFromRequest } from "./session.server.ts";
import { requireMfaAssurance } from "./route-context.server.ts";

export const disconnectMerchantMercadoPago = createServerFn({ method: "POST" }).handler(async () => {
  const session = await resolveSessionFromRequest();
  if (!session) throw new Error("Sessão administrativa necessária para desconectar o Mercado Pago.");
  requireMfaAssurance(session);

  const context = await createMerchantCatalogContext(getRequestHost());
  if (context.userId !== session.userId) throw new Error("Sessão administrativa incompatível.");

  const rows = await createAdminSqlExecutor().query(
    `with account as (
       update public.gateway_accounts
       set status='disabled',updated_at=now()
       where level='store_checkout' and provider='mercadopago'
         and tenant_id=$1::uuid and store_id=$2::uuid and status='active'
       returning id
     ), cleared as (
       update private.gateway_account_secrets s
       set credentials_ciphertext=null,webhook_secret_ciphertext=null,
           oauth_refresh_token_ciphertext=null,oauth_access_token_expires_at=null,updated_at=now()
       from account where s.gateway_account_id=account.id
       returning s.gateway_account_id
     ), audited as (
       insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
       select $3::uuid,$1::uuid,$2::uuid,'gateway_account.oauth_disconnected','gateway_account',id::text,
              jsonb_build_object('provider','mercadopago','level','store_checkout')
       from account
     ) select id::text from account`,
    [context.scope.tenantId, context.scope.storeId, session.userId],
  );

  return { ok: true, disconnected: rows.length > 0 };
});
