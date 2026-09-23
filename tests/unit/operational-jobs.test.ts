import { describe, expect, test } from "bun:test";
import type { WorkerSql } from "../../apps/worker/src/database.ts";
import { dispatchOperationalJob } from "../../apps/worker/src/jobs/handlers.ts";
import { scheduleOperationalJobs } from "../../apps/worker/src/jobs/scheduler.ts";
import { getOperationalQueueHealth } from "../../apps/worker/src/jobs/store.ts";
import type { OperationalJob } from "../../apps/worker/src/jobs/types.ts";

class FakeSql implements WorkerSql {
  readonly calls: Array<{ sql: string; params: unknown[] }> = [];
  constructor(private readonly results: Record<string, unknown>[][]) {}
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
    this.calls.push({ sql, params });
    return Promise.resolve(this.results.shift() ?? []);
  }
}

function job(kind: OperationalJob["kind"]): OperationalJob {
  return { id: "job-1", tenantId: "tenant-a", storeId: null, kind, payloadVersion: 1, payload: {}, attempts: 1, maxAttempts: 3 };
}

function operationalSql(results: Record<string, unknown>[][] = []): FakeSql {
  return new FakeSql([[{ tenant_status: "active", store_status: null }], ...results]);
}

async function rejectionMessage(promise: Promise<void>): Promise<string> {
  try { await promise; } catch (error) { return error instanceof Error ? error.message : "unknown"; }
  throw new Error("Promise deveria rejeitar.");
}

describe("operational worker", () => {
  test("scheduler derives domain, billing and media jobs and enqueues idempotently", async () => {
    const sql = new FakeSql([
      [{ id: "d1", tenant_id: "t1", store_id: null, verification_token: "token" }],
      [{ id: "p1", tenant_id: "t1", store_id: "s1", level: "tenant_billing" }],
      [{ id: "m1", tenant_id: "t1", store_id: "s1", status: "failed" }],
      [{ id: "j1" }], [{ id: "j2" }], [{ id: "j3" }],
    ]);
    expect(await scheduleOperationalJobs(sql)).toBe(3);
    const inserts = sql.calls.filter((call) => call.sql.includes("insert into public.operational_jobs"));
    expect(inserts).toHaveLength(3);
    expect(inserts[0]?.params).toContain("domain:d1:token");
    expect(inserts[1]?.params).toContain("billing:p1");
    expect(inserts[2]?.params).toContain("media:m1:failed");
  });

  test("queue health normalizes counts and oldest ready age", async () => {
    const sql = new FakeSql([[{
      queued: 3, retry: 2, running: 1, dead_letter: 4, expired_leases: 1,
      oldest_ready_age_seconds: 91,
    }]]);
    expect(await getOperationalQueueHealth(sql)).toEqual({
      queued: 3, retry: 2, running: 1, deadLetter: 4, expiredLeases: 1,
      oldestReadyAgeSeconds: 91,
    });
    expect(sql.calls[0]?.sql).toContain("expired_leases");
  });

  test("email is unavailable until a real provider exists", async () => {
    const email = { ...job("email.send"), payload: { to: "owner@example.test", subject: "Teste" } };
    expect(await rejectionMessage(dispatchOperationalJob(new FakeSql([]), email)))
      .toContain("nenhum provider de e-mail foi configurado");
  });

  test("suspended scope fails before handler side effects", async () => {
    const suspended = new FakeSql([[{ tenant_status: "suspended", store_status: null }]]);
    expect(await rejectionMessage(dispatchOperationalJob(suspended, { ...job("domain.verify"), payload: { domainId: "d1" } })))
      .toContain("Escopo do job suspenso");
    expect(suspended.calls).toHaveLength(1);
  });

  test("invalid payloads fail before side effects after operational scope validation", async () => {
    expect(await rejectionMessage(dispatchOperationalJob(operationalSql(), job("domain.verify")))).toContain("domainId");
    expect(await rejectionMessage(dispatchOperationalJob(operationalSql(), job("billing.reconcile")))).toContain("paymentId");
    expect(await rejectionMessage(dispatchOperationalJob(operationalSql(), job("media.process")))).toContain("assetId");
  });
});
