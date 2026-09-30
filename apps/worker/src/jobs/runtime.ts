import { randomUUID } from "node:crypto";
import { workerSql } from "../database.ts";
import { dispatchOperationalJob } from "./handlers.ts";
import { scheduleOperationalJobs } from "./scheduler.ts";
import { claimJobs, completeJob, failJob, getOperationalQueueHealth, purgeCompletedJobs, reapExhaustedLeases } from "./store.ts";

const workerId=`worker-${randomUUID()}`;

export async function operationalTick(): Promise<{ scheduled:number;processed:number }> {
  const sql=workerSql();
  const concurrency=Math.max(1,Number(process.env["WORKER_CONCURRENCY"]??5));
  await Promise.all([reapExhaustedLeases(sql),purgeCompletedJobs(sql)]);
  const scheduled=await scheduleOperationalJobs(sql);
  const jobs=await claimJobs(sql,workerId,concurrency);
  await Promise.all(jobs.map(async(job)=>{
    try {
      await dispatchOperationalJob(sql,job);
      await completeJob(sql,job.id,workerId);
    } catch(error) {
      const state=await failJob(sql,job,workerId,error);
      if(state==="dead_letter") {
        console.error("[worker] operational job dead-letter.",{jobId:job.id,kind:job.kind});
      }
    }
  }));
  const health=await getOperationalQueueHealth(sql);
  if(health.deadLetter>0 || health.expiredLeases>0) {
    console.error(JSON.stringify({level:"error",message:"worker.queue.unhealthy",...health}));
  } else if((health.oldestReadyAgeSeconds ?? 0)>300) {
    console.warn(JSON.stringify({level:"warn",message:"worker.queue.delayed",...health}));
  }
  return {scheduled,processed:jobs.length};
}
