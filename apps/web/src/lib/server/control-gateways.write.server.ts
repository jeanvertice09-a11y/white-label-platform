import type { CredentialVault } from "@white-label/payments/server";
import type { ControlSql } from "./control-merchants.shared.server.ts";
import type {
  CreateGatewayAccountInput,
  GatewayAccountStatus,
  GatewayScope,
  SafeGatewayAccount,
  UpdateGatewayAccountInput,
} from "./control-gateways.types.ts";
import { assertGatewayScope } from "./control-gateways.scope.server.ts";

const UPDATE_SQL = `with account as (
  update public.gateway_accounts
  set label=$5,public_identifier=$6,updated_at=now()
  where id=$4::uuid and level=$1
    and tenant_id is not distinct from $2::uuid
    and store_id is not distinct from $3::uuid
  returning *
), secret as (
  update private.gateway_account_secrets s
  set credentials_ciphertext=coalesce($7,s.credentials_ciphertext),
      webhook_secret_ciphertext=coalesce($8,s.webhook_secret_ciphertext),
      updated_at=now()
  from account a where s.gateway_account_id=a.id
  returning s.gateway_account_id,s.credentials_ciphertext,s.webhook_secret_ciphertext
), audit_update as (
  insert into public.audit_logs(
    actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
  )
  select $9::uuid,tenant_id,store_id,'gateway_account.updated','gateway_account',id::text,
    jsonb_build_object('provider',provider,'level',level,'status',status)
  from account returning id
), audit_secret as (
  insert into public.audit_logs(
    actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
  )
  select $9::uuid,tenant_id,store_id,'gateway_account.credentials_updated',
    'gateway_account',id::text,
    jsonb_build_object(
      'credentialsChanged',$10::boolean,'webhookSecretChanged',$11::boolean
    )
  from account where $10::boolean or $11::boolean
  returning id
)
select a.id::text,a.level,a.tenant_id::text,a.store_id::text,a.provider,a.label,
  a.public_identifier,a.status,a.created_at::text,a.updated_at::text,
  (s.credentials_ciphertext is not null) configured,
  (s.webhook_secret_ciphertext is not null) webhook_configured
from account a join secret s on s.gateway_account_id=a.id`;

function cleanLabel(value: string): string {
  const label = value.trim();
  if (!label) throw new Error("Nome da conta de gateway é obrigatório.");
  return label;
}

function cleanPublicIdentifier(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function optionalCiphertext(vault: CredentialVault, value: string): string | null {
  return value.trim() ? vault.encrypt(value) : null;
}

async function assertStoreScopeExists(sql: ControlSql, scope: GatewayScope): Promise<void> {
  if (scope.level !== "store_checkout") return;
  const rows = await sql.query(
    "select exists(select 1 from public.stores where tenant_id=$1::uuid and id=$2::uuid) ok",
    [scope.tenantId, scope.storeId],
  );
  if (rows.at(0)?.["ok"] !== true) throw new Error("Loja não pertence ao tenant do gateway.");
}

function mapResult(row: Record<string, unknown>): SafeGatewayAccount {
  return {
    id: String(row["id"]),
    level: String(row["level"]) as SafeGatewayAccount["level"],
    tenantId: typeof row["tenant_id"] === "string" ? row["tenant_id"] : null,
    storeId: typeof row["store_id"] === "string" ? row["store_id"] : null,
    provider: String(row["provider"]) as SafeGatewayAccount["provider"],
    label: String(row["label"]),
    publicIdentifier: typeof row["public_identifier"] === "string" ? row["public_identifier"] : null,
    status: String(row["status"]) as GatewayAccountStatus,
    configured: row["configured"] === true,
    webhookConfigured: row["webhook_configured"] === true,
    createdAt: String(row["created_at"]),
    updatedAt: String(row["updated_at"]),
  };
}

export async function createGatewayAccount(
  sql: ControlSql,
  vault: CredentialVault,
  actorUserId: string,
  scope: GatewayScope,
  input: CreateGatewayAccountInput,
): Promise<SafeGatewayAccount> {
  assertGatewayScope(scope);
  await assertStoreScopeExists(sql, scope);
  const credentials = optionalCiphertext(vault, input.credentials);
  const webhook = optionalCiphertext(vault, input.webhookSecret);
  const status: GatewayAccountStatus = credentials ? "active" : "disabled";
  const rows = await sql.query(
    `with account as (
       insert into public.gateway_accounts(
         level,tenant_id,store_id,provider,label,public_identifier,status,updated_at
       ) values ($1,$2::uuid,$3::uuid,$4,$5,$6,$7,now())
       returning *
     ), secret as (
       insert into private.gateway_account_secrets(
         gateway_account_id,credentials_ciphertext,webhook_secret_ciphertext
       )
       select id,$8,$9 from account
       returning gateway_account_id
     ), audit as (
       insert into public.audit_logs(
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select $10::uuid,tenant_id,store_id,'gateway_account.created','gateway_account',id::text,
         jsonb_build_object(
           'provider',provider,'level',level,'status',status,
           'configured',$11::boolean,'webhookConfigured',$12::boolean
         )
       from account returning id
     )
     select a.id::text,a.level,a.tenant_id::text,a.store_id::text,a.provider,a.label,
       a.public_identifier,a.status,a.created_at::text,a.updated_at::text,
       $11::boolean configured,$12::boolean webhook_configured
     from account a`,
    [
      scope.level, scope.tenantId, scope.storeId, input.provider,
      cleanLabel(input.label), cleanPublicIdentifier(input.publicIdentifier),
      status, credentials, webhook, actorUserId, credentials !== null, webhook !== null,
    ],
  );
  const row = rows.at(0);
  if (!row) throw new Error("Não foi possível criar a conta de gateway.");
  return mapResult(row);
}

async function assertGatewayOwned(
  sql: ControlSql,
  scope: GatewayScope,
  gatewayAccountId: string,
): Promise<void> {
  const rows = await sql.query(
    `select id from public.gateway_accounts
     where id=$4::uuid and level=$1
       and tenant_id is not distinct from $2::uuid
       and store_id is not distinct from $3::uuid`,
    [scope.level, scope.tenantId, scope.storeId, gatewayAccountId],
  );
  if (!rows.at(0)) throw new Error("Conta de gateway não encontrada neste escopo.");
}

export async function updateGatewayAccount(
  sql: ControlSql,
  vault: CredentialVault,
  actorUserId: string,
  scope: GatewayScope,
  input: UpdateGatewayAccountInput,
): Promise<SafeGatewayAccount> {
  assertGatewayScope(scope);
  await assertGatewayOwned(sql, scope, input.gatewayAccountId);
  const credentials = optionalCiphertext(vault, input.credentials);
  const webhook = optionalCiphertext(vault, input.webhookSecret);
  const rows = await sql.query(UPDATE_SQL, [
    scope.level, scope.tenantId, scope.storeId, input.gatewayAccountId,
    cleanLabel(input.label), cleanPublicIdentifier(input.publicIdentifier),
    credentials, webhook, actorUserId, credentials !== null, webhook !== null,
  ]);
  const row = rows.at(0);
  if (!row) throw new Error("Conta de gateway não encontrada neste escopo.");
  return mapResult(row);
}

async function assertConfiguredForActivation(
  sql: ControlSql,
  scope: GatewayScope,
  gatewayAccountId: string,
): Promise<void> {
  const rows = await sql.query(
    `select exists(
       select 1 from public.gateway_accounts ga
       join private.gateway_account_secrets s on s.gateway_account_id=ga.id
       where ga.id=$4::uuid and ga.level=$1
         and ga.tenant_id is not distinct from $2::uuid
         and ga.store_id is not distinct from $3::uuid
         and s.credentials_ciphertext is not null
     ) ok`,
    [scope.level, scope.tenantId, scope.storeId, gatewayAccountId],
  );
  if (rows.at(0)?.["ok"] !== true) {
    throw new Error("Conta sem credencial configurada não pode ser ativada.");
  }
}

export async function setGatewayAccountStatus(
  sql: ControlSql,
  actorUserId: string,
  scope: GatewayScope,
  gatewayAccountId: string,
  status: GatewayAccountStatus,
): Promise<SafeGatewayAccount> {
  assertGatewayScope(scope);
  if (status === "active") await assertConfiguredForActivation(sql, scope, gatewayAccountId);
  const action = status === "disabled" ? "gateway_account.disabled" : "gateway_account.enabled";
  const rows = await sql.query(
    `with account as (
       update public.gateway_accounts set status=$5,updated_at=now()
       where id=$4::uuid and level=$1
         and tenant_id is not distinct from $2::uuid
         and store_id is not distinct from $3::uuid
       returning *
     ), audit as (
       insert into public.audit_logs(
         actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata
       )
       select $6::uuid,tenant_id,store_id,$7,'gateway_account',id::text,
         jsonb_build_object('provider',provider,'level',level,'status',status)
       from account returning id
     )
     select a.id::text,a.level,a.tenant_id::text,a.store_id::text,a.provider,a.label,
       a.public_identifier,a.status,a.created_at::text,a.updated_at::text,
       exists(select 1 from private.gateway_account_secrets s
         where s.gateway_account_id=a.id and s.credentials_ciphertext is not null) configured,
       exists(select 1 from private.gateway_account_secrets s
         where s.gateway_account_id=a.id and s.webhook_secret_ciphertext is not null) webhook_configured
     from account a`,
    [scope.level, scope.tenantId, scope.storeId, gatewayAccountId, status, actorUserId, action],
  );
  const row = rows.at(0);
  if (!row) throw new Error("Conta de gateway não encontrada neste escopo.");
  return mapResult(row);
}
