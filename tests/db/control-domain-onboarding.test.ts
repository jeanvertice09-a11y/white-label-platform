import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DomainResolver, PostgresDomainStore, type DomainProvider, type DomainVerificationResult } from "@white-label/domains";
import type { Harness } from "./harness.ts";
import { setupDatabase } from "./harness.ts";
import { seedIds, seedSql } from "./seed.ts";
import { loadControlDomainWorkspace } from "../../apps/web/src/lib/server/control-domains.read.server.ts";
import { createControlDomain, deleteControlDomain, setControlDomainStatus, updateControlDomain } from "../../apps/web/src/lib/server/control-domains.write.server.ts";
import { verifyControlDomain } from "../../apps/web/src/lib/server/control-domains.verify.server.ts";

let h: Harness;
const ids = seedIds();
const actor = ids.users.tenantA;

function provider(verified: boolean, configured = true): DomainProvider {
  return {
    name: "test-dns",
    configured,
    getDnsInstructions(challenge) {
      return configured
        ? { available: true, message: "dns", records: [{ type: "TXT", host: `_verify.${challenge.hostname}`, value: challenge.verificationToken }] }
        : { available: false, message: "Configuração de domínio da plataforma não disponível.", records: [] };
    },
    async verifyDomain(): Promise<DomainVerificationResult> {
      return Promise.resolve({
        configured,
        verified: configured && verified,
        reason: configured && verified ? "DNS confirmado." : "DNS pendente.",
        checkedAt: new Date().toISOString(),
        evidence: { cnameMatches: configured && verified, txtMatches: configured && verified },
      });
    },
  };
}

beforeAll(async () => {
  h = await setupDatabase();
  await h.db.execScript(seedSql());
});
afterAll(async () => { await h.db.close(); });

describe("fase 07 domain onboarding", () => {
  test("lista somente domínios do tenant e não expõe coluna verification_token", async () => {
    await createControlDomain(h.db, ids.tenantA, actor, { hostname: "tenant-a.example.test", type: "tenant_panel", storeId: null });
    await createControlDomain(h.db, ids.tenantB, ids.users.tenantB, { hostname: "tenant-b.example.test", type: "tenant_panel", storeId: null });
    const workspace = await loadControlDomainWorkspace(h.db, ids.tenantA, provider(false), true);
    expect(workspace.domains.some((item) => item.hostname === "tenant-a.example.test")).toBe(true);
    expect(workspace.domains.some((item) => item.hostname === "tenant-b.example.test")).toBe(false);
    expect(JSON.stringify(workspace)).not.toContain("verification_token");
  });

  test("hostname duplicado e store de outro tenant são bloqueados", async () => {
    await expect(createControlDomain(h.db, ids.tenantB, ids.users.tenantB, {
      hostname: "tenant-a.example.test", type: "tenant_panel", storeId: null,
    })).rejects.toThrow("Hostname já está cadastrado");
    await expect(createControlDomain(h.db, ids.tenantA, actor, {
      hostname: "cross-store.example.test", type: "store_catalog", storeId: ids.storeB,
    })).rejects.toThrow();
    const partial = await h.db.query("select id from public.domains where hostname='cross-store.example.test'", []);
    expect(partial).toHaveLength(0);
  });

  test("sem evidência real permanece pending e provider indisponível não ativa", async () => {
    const created = await createControlDomain(h.db, ids.tenantA, actor, { hostname: "pending.example.test", type: "store_catalog", storeId: ids.storeA });
    const unavailable = await verifyControlDomain(h.db, ids.tenantA, actor, created.id, provider(false, false));
    expect(unavailable.verified).toBe(false);
    const negative = await verifyControlDomain(h.db, ids.tenantA, actor, created.id, provider(false));
    expect(negative.verified).toBe(false);
    const rows = await h.db.query("select status,verified_at from public.domains where id=$1::uuid", [created.id]);
    expect(rows[0]?.["status"]).toBe("pending");
    expect(rows[0]?.["verified_at"]).toBeNull();
  });

  test("evidência positiva ativa e DomainResolver passa a resolver", async () => {
    const created = await createControlDomain(h.db, ids.tenantA, actor, { hostname: "verified.example.test", type: "store_catalog", storeId: ids.storeA });
    const resolver = new DomainResolver(new PostgresDomainStore(h.db));
    expect(await resolver.resolve("verified.example.test")).toBeNull();
    const result = await verifyControlDomain(h.db, ids.tenantA, actor, created.id, provider(true));
    expect(result.verified).toBe(true);
    expect(result.status).toBe("active");
    expect(await resolver.resolve("verified.example.test")).toEqual({ tenantId: ids.tenantA, storeId: ids.storeA, type: "store_catalog" });
    await setControlDomainStatus(h.db, ids.tenantA, actor, created.id, "suspended");
    expect(await resolver.resolve("verified.example.test")).toBeNull();
  });

  test("IDOR não edita, verifica, suspende ou remove domínio de outro tenant", async () => {
    const created = await createControlDomain(h.db, ids.tenantB, ids.users.tenantB, { hostname: "idor-b.example.test", type: "tenant_panel", storeId: null });
    await expect(updateControlDomain(h.db, ids.tenantA, actor, { domainId: created.id, hostname: "idor-a.example.test", type: "tenant_panel", storeId: null })).rejects.toThrow();
    await expect(verifyControlDomain(h.db, ids.tenantA, actor, created.id, provider(true))).rejects.toThrow();
    await expect(setControlDomainStatus(h.db, ids.tenantA, actor, created.id, "suspended")).rejects.toThrow();
    await expect(deleteControlDomain(h.db, ids.tenantA, actor, created.id)).rejects.toThrow();
    const rows = await h.db.query("select hostname,status from public.domains where id=$1::uuid", [created.id]);
    expect(rows[0]?.["hostname"]).toBe("idor-b.example.test");
    expect(rows[0]?.["status"]).toBe("pending");
  });

  test("edição invalida verificação, gera novo pending e auditoria não grava desafio", async () => {
    const created = await createControlDomain(h.db, ids.tenantA, actor, { hostname: "edit-before.example.test", type: "tenant_panel", storeId: null });
    await verifyControlDomain(h.db, ids.tenantA, actor, created.id, provider(true));
    await updateControlDomain(h.db, ids.tenantA, actor, { domainId: created.id, hostname: "edit-after.example.test", type: "tenant_panel", storeId: null });
    const rows = await h.db.query("select status,verified_at,verification_token from public.domains where id=$1::uuid", [created.id]);
    expect(rows[0]?.["status"]).toBe("pending");
    expect(rows[0]?.["verified_at"]).toBeNull();
    expect(typeof rows[0]?.["verification_token"]).toBe("string");
    const audits = await h.db.query("select action,metadata::text metadata from public.audit_logs where tenant_id=$1::uuid and resource_id=$2 order by created_at", [ids.tenantA, created.id]);
    expect(audits.map((row) => row["action"])).toContain("control.domain.verified");
    expect(audits.map((row) => row["action"])).toContain("control.domain.activated");
    expect(audits.map((row) => String(row["metadata"])).join(" ")).not.toContain(String(rows[0]?.["verification_token"]));
  });
});
