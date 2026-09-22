import { describe,expect,test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=join(import.meta.dir,"..","..");
const migration=readFileSync(join(root,"supabase","migrations","0034_operational_jobs.sql"),"utf8");
const scheduler=readFileSync(join(root,"apps","worker","src","jobs","scheduler.ts"),"utf8");
const handlers=readFileSync(join(root,"apps","worker","src","jobs","handlers.ts"),"utf8");
const recovery=readFileSync(join(root,"apps","web","src","lib","server","control-operational-jobs.functions.ts"),"utf8");

describe("operational jobs security boundary",()=>{
  test("queue is server-only and store scope is composite",()=>{
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("foreign key (tenant_id, store_id)");
    expect(migration).not.toContain("create policy");
  });
  test("scheduler derives scopes from database records",()=>{
    expect(scheduler).not.toContain("actorUserId");
    expect(scheduler).toContain("select id::text,tenant_id::text,store_id::text");
  });
  test("handlers revalidate tenant/store ownership before side effects",()=>{
    expect(handlers).toContain("tenant_id=$2::uuid");
    expect(handlers).toContain("store_id is not distinct from $3::uuid");
    expect(handlers).toContain("Pagamento fora do escopo do job.");
    expect(handlers).toContain("Mídia fora do escopo do job.");
  });
  test("dead-letter recovery derives tenant and actor from authenticated control context",()=>{
    expect(recovery).toContain("controlMerchantMutation()");
    expect(recovery).toContain("tenant_id=$2::uuid");
    expect(recovery).toContain("status='dead_letter'");
    expect(recovery).toContain("control.job.retried");
  });
  test("email remains fail-closed without a real provider",()=>{
    expect(handlers).toContain("nenhum provider de e-mail foi configurado");
  });
});
