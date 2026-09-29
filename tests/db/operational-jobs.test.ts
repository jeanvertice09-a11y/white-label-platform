import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { expectReject, setupDatabase } from "./harness.ts";
import type { Harness } from "./harness.ts";
import { S, T, U, seedSql } from "./seed.ts";

let h: Harness;
beforeAll(async () => { h = await setupDatabase(); await h.db.execScript(seedSql()); });
afterAll(async () => { await h.db.close(); });

describe("operational jobs durable queue", () => {
  test("idempotency prevents duplicate jobs", async () => {
    await h.db.execOne(`insert into public.operational_jobs(tenant_id,store_id,kind,idempotency_key,payload)
      values ('${T.a}','${S.a}','domain.verify','same','{}')`);
    await expectReject(h.db.execOne(`insert into public.operational_jobs(tenant_id,store_id,kind,idempotency_key,payload)
      values ('${T.a}','${S.a}','domain.verify','same','{}')`), "duplicate idempotency key");
  });

  test("composite scope rejects store from another tenant", async () => {
    await expectReject(h.db.execOne(`insert into public.operational_jobs(tenant_id,store_id,kind,idempotency_key,payload)
      values ('${T.a}','${S.b}','media.process','cross','{}')`), "cross tenant/store job");
  });

  test("claim increments attempts and active lease prevents a second claim", async () => {
    await h.db.execOne(`insert into public.operational_jobs(tenant_id,kind,idempotency_key,payload)
      values ('${T.a}','domain.verify','claim','{}')`);
    const first = await h.db.query(`with c as (
      select id from public.operational_jobs where status='queued' and idempotency_key='claim' for update skip locked limit 1)
      update public.operational_jobs j set status='running',attempts=attempts+1,locked_by='w1',
      lease_expires_at=now()+interval '2 minutes' from c where j.id=c.id returning attempts`);
    expect(first[0]?.["attempts"]).toBe(1);
    const second = await h.db.query(`select id from public.operational_jobs
      where idempotency_key='claim' and (status in ('queued','retry') or (status='running' and lease_expires_at<now()))`);
    expect(second).toHaveLength(0);
  });

  test("expired lease is recoverable and dead-letter is terminal", async () => {
    await h.db.execOne(`insert into public.operational_jobs(tenant_id,kind,idempotency_key,payload,status,attempts,max_attempts,locked_by,lease_expires_at)
      values ('${T.a}','domain.verify','lease','{}','running',1,2,'dead-worker',now()-interval '1 minute')`);
    const rows = await h.db.query(`update public.operational_jobs set status='running',attempts=attempts+1,
      locked_by='w2',lease_expires_at=now()+interval '1 minute'
      where id=(select id from public.operational_jobs where status='running' and lease_expires_at<now() limit 1)
      returning attempts,max_attempts`);
    expect(rows[0]).toMatchObject({ attempts: 2, max_attempts: 2 });
    await h.db.execOne(`update public.operational_jobs set status='dead_letter',locked_by=null,lease_expires_at=null
      where idempotency_key='lease'`);
    const terminal = await h.db.query("select status from public.operational_jobs where idempotency_key='lease'");
    expect(terminal[0]?.["status"]).toBe("dead_letter");
  });

  test("browser roles receive no direct queue policy", async () => {
    const policies = await h.db.query("select policyname from pg_policies where tablename='operational_jobs'");
    expect(policies).toHaveLength(0);
    await expectReject(h.asUser(U.tenantA, "authenticated", () => h.db.execOne(
      `insert into public.operational_jobs(tenant_id,kind,idempotency_key,payload)
       values ('${T.a}','domain.verify','browser','{}')`,
    )), "browser enqueue");
  });
});
