import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createCredentialVaultFromKeyring } from "../../packages/payments/src/server/credential-vault.ts";
import {
  createGatewayAccount,
  setGatewayAccountStatus,
  updateGatewayAccount,
} from "../../apps/web/src/lib/server/control-gateways.write.server.ts";
import { listSafeGatewayAccounts } from "../../apps/web/src/lib/server/control-gateways.read.server.ts";
import { loadGatewayCredentialMaterial } from "../../apps/web/src/lib/server/gateway-credentials.server.ts";
import type { GatewayScope } from "../../apps/web/src/lib/server/control-gateways.types.ts";
import { expectReject, setupDatabase, type Harness } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";

let h: Harness;
const ids = seedIds();
const actor = ids.users.tenantA;
const vault = createCredentialVaultFromKeyring({
  "1": Buffer.alloc(32, 9).toString("base64"),
});
const tenantA: GatewayScope = {
  level: "tenant_billing",
  tenantId: ids.tenantA,
  storeId: null,
};
const tenantAStoreGateway: GatewayScope = { level: "store_checkout", tenantId: ids.tenantA, storeId: ids.storeA };
const tenantB: GatewayScope = {
  level: "tenant_billing",
  tenantId: ids.tenantB,
  storeId: null,
};
const storeA: GatewayScope = {
  level: "store_checkout",
  tenantId: ids.tenantA,
  storeId: ids.storeA,
};
const storeB: GatewayScope = {
  level: "store_checkout",
  tenantId: ids.tenantB,
  storeId: ids.storeB,
};

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
});

afterAll(async () => {
  await h.db.close();
});

describe("fase 09 secure gateway accounts", () => {
  test("migration cria metadata pública e cofre privado deny-by-default", async () => {
    const columns = await h.db.query(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='gateway_accounts'
       and column_name in ('public_identifier','status','updated_at')
       order by column_name`,
    );
    expect(columns.map((row) => row["column_name"])).toEqual([
      "public_identifier",
      "status",
      "updated_at",
    ]);
    const privateTable = await h.db.query(
      `select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='private' and c.relname='gateway_account_secrets'`,
    );
    expect(privateTable.at(0)?.["relrowsecurity"]).toBe(true);
    await expectReject(
      h.asUser(ids.users.tenantA, "authenticated", async () =>
        h.db.query("select * from private.gateway_account_secrets"),
      ),
      "authenticated não acessa ciphertext privado",
    );
  });

  test("create cifra segredo e leitura segura nunca devolve segredo/ciphertext", async () => {
    const credential = "fixture-credential-create";
    const webhook = "fixture-webhook-create";
    const created = await createGatewayAccount(h.db, vault, actor, tenantA, {
      provider: "mercadopago",
      label: "MP Tenant A",
      publicIdentifier: "public-fixture-a",
      credentials: credential,
      webhookSecret: webhook,
    });
    expect(created.configured).toBe(true);
    expect(created.webhookConfigured).toBe(true);

    const secretRows = await h.db.query(
      `select credentials_ciphertext,webhook_secret_ciphertext
       from private.gateway_account_secrets where gateway_account_id=$1::uuid`,
      [created.id],
    );
    const credentialCiphertext = String(secretRows.at(0)?.["credentials_ciphertext"]);
    const webhookCiphertext = String(secretRows.at(0)?.["webhook_secret_ciphertext"]);
    expect(credentialCiphertext).not.toContain(credential);
    expect(webhookCiphertext).not.toContain(webhook);
    expect(vault.decrypt(credentialCiphertext)).toBe(credential);
    expect(vault.decrypt(webhookCiphertext)).toBe(webhook);

    const safe = await listSafeGatewayAccounts(h.db, tenantA);
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain(credential);
    expect(serialized).not.toContain(webhook);
    expect(serialized).not.toContain("ciphertext");
  });

  test("update vazio preserva credencial e troca explícita substitui ciphertext", async () => {
    const created = await createGatewayAccount(h.db, vault, actor, tenantAStoreGateway, {
      provider: "asaas",
      label: "Asaas Preserve",
      publicIdentifier: null,
      credentials: "fixture-preserve-old",
      webhookSecret: "fixture-webhook-old",
    });
    const before = await h.db.query(
      `select credentials_ciphertext,webhook_secret_ciphertext
       from private.gateway_account_secrets where gateway_account_id=$1::uuid`,
      [created.id],
    );
    await updateGatewayAccount(h.db, vault, actor, tenantAStoreGateway, {
      gatewayAccountId: created.id,
      label: "Asaas Metadata",
      publicIdentifier: "safe-public-id",
      credentials: "",
      webhookSecret: "   ",
    });
    const preserved = await h.db.query(
      `select credentials_ciphertext,webhook_secret_ciphertext
       from private.gateway_account_secrets where gateway_account_id=$1::uuid`,
      [created.id],
    );
    expect(preserved).toEqual(before);

    await updateGatewayAccount(h.db, vault, actor, tenantAStoreGateway, {
      gatewayAccountId: created.id,
      label: "Asaas Metadata",
      publicIdentifier: "safe-public-id",
      credentials: "fixture-preserve-new",
      webhookSecret: "fixture-webhook-new",
    });
    const replaced = await h.db.query(
      `select credentials_ciphertext,webhook_secret_ciphertext
       from private.gateway_account_secrets where gateway_account_id=$1::uuid`,
      [created.id],
    );
    const newCredential = String(replaced.at(0)?.["credentials_ciphertext"]);
    expect(newCredential).not.toBe(String(before.at(0)?.["credentials_ciphertext"]));
    expect(vault.decrypt(newCredential)).toBe("fixture-preserve-new");
  });

  test("disable funciona e conta sem credencial não pode ser habilitada", async () => {
    const configured = await createGatewayAccount(h.db, vault, actor, storeA, {
      provider: "mercadopago",
      label: "Checkout A",
      publicIdentifier: null,
      credentials: "fixture-store-a",
      webhookSecret: "",
    });
    const disabled = await setGatewayAccountStatus(
      h.db,
      actor,
      storeA,
      configured.id,
      "disabled",
    );
    expect(disabled.status).toBe("disabled");
    const enabled = await setGatewayAccountStatus(h.db, actor, storeA, configured.id, "active");
    expect(enabled.status).toBe("active");

    const empty = await createGatewayAccount(h.db, vault, actor, tenantA, {
      provider: "mercadopago",
      label: "Unconfigured",
      publicIdentifier: null,
      credentials: "",
      webhookSecret: "",
    });
    expect(empty.status).toBe("disabled");
    await expectReject(
      setGatewayAccountStatus(h.db, actor, tenantA, empty.id, "active"),
      "conta sem credencial não ativa",
    );
  });

  test("IDOR e cross-tenant/store não atravessam escopo", async () => {
    const account = await createGatewayAccount(h.db, vault, actor, tenantAStoreGateway, {
      provider: "asaas",
      label: "Tenant A Isolado",
      publicIdentifier: null,
      credentials: "fixture-isolation",
      webhookSecret: "",
    });
    await expectReject(
      updateGatewayAccount(h.db, vault, actor, tenantB, {
        gatewayAccountId: account.id,
        label: "Ataque",
        publicIdentifier: null,
        credentials: "attacker-fixture",
        webhookSecret: "",
      }),
      "tenant B não edita gateway A",
    );
    await expectReject(
      setGatewayAccountStatus(h.db, actor, tenantB, account.id, "disabled"),
      "tenant B não desabilita gateway A",
    );
    expect((await listSafeGatewayAccounts(h.db, tenantB)).some((item) => item.id === account.id)).toBe(false);

    const storeAccount = await createGatewayAccount(h.db, vault, actor, storeA, {
      provider: "asaas",
      label: "Store A Isolada",
      publicIdentifier: null,
      credentials: "fixture-store-isolation",
      webhookSecret: "",
    });
    await expectReject(
      setGatewayAccountStatus(h.db, actor, storeB, storeAccount.id, "disabled"),
      "store B não altera gateway da store A",
    );
  });

  test("level/context e provider inválidos são rejeitados pelo banco", async () => {
    await expectReject(
      h.db.query(
        `insert into public.gateway_accounts(level,tenant_id,store_id,provider,label)
         values('tenant_billing',$1::uuid,$2::uuid,'mercadopago','wrong-scope')`,
        [ids.tenantA, ids.storeA],
      ),
      "tenant_billing não aceita store_id",
    );
    await expectReject(
      h.db.query(
        `insert into public.gateway_accounts(level,tenant_id,store_id,provider,label)
         values('tenant_billing',$1::uuid,null,'provider-invalido','invalid-provider')`,
        [ids.tenantA],
      ),
      "provider inválido",
    );
    await expectReject(
      createGatewayAccount(h.db, vault, actor, {
        level: "store_checkout",
        tenantId: ids.tenantA,
        storeId: ids.storeB,
      }, {
        provider: "mercadopago",
        label: "Cross store",
        publicIdentifier: null,
        credentials: "fixture-cross-store",
        webhookSecret: "",
      }),
      "store de outro tenant",
    );
  });

  test("material descriptografado é server-only, scoped e exige conta ativa", async () => {
    const account = await createGatewayAccount(h.db, vault, actor, tenantA, {
      provider: "mercadopago",
      label: "Server material",
      publicIdentifier: "public-server-id",
      credentials: "fixture-server-material",
      webhookSecret: "fixture-server-webhook",
    });
    const material = await loadGatewayCredentialMaterial(
      h.db,
      vault,
      tenantA,
      account.id,
    );
    expect(material.credentials).toBe("fixture-server-material");
    expect(material.webhookSecret).toBe("fixture-server-webhook");

    await expectReject(
      loadGatewayCredentialMaterial(h.db, vault, tenantB, account.id),
      "tenant B não descriptografa gateway A",
    );
    await setGatewayAccountStatus(h.db, actor, tenantA, account.id, "disabled");
    await expectReject(
      loadGatewayCredentialMaterial(h.db, vault, tenantA, account.id),
      "gateway desabilitado não pode ser utilizado",
    );
  });

  test("auditoria registra ações sem plaintext, webhook secret ou ciphertext", async () => {
    const credential = "fixture-audit-credential";
    const webhook = "fixture-audit-webhook";
    const account = await createGatewayAccount(h.db, vault, actor, tenantA, {
      provider: "mercadopago",
      label: "Audit",
      publicIdentifier: null,
      credentials: credential,
      webhookSecret: webhook,
    });
    await updateGatewayAccount(h.db, vault, actor, tenantAStoreGateway, {
      gatewayAccountId: account.id,
      label: "Audit Updated",
      publicIdentifier: null,
      credentials: "fixture-audit-replaced",
      webhookSecret: "",
    });
    await setGatewayAccountStatus(h.db, actor, tenantA, account.id, "disabled");

    const audits = await h.db.query(
      `select action,metadata::text metadata from public.audit_logs
       where resource_type='gateway_account' and resource_id=$1`,
      [account.id],
    );
    const serialized = JSON.stringify(audits);
    expect(serialized).not.toContain(credential);
    expect(serialized).not.toContain(webhook);
    expect(serialized).not.toContain("cv1.");
    expect(audits.map((row) => row["action"])).toContain("gateway_account.credentials_updated");
    expect(audits.map((row) => row["action"])).toContain("gateway_account.disabled");
  });
});
