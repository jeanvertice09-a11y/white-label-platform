import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { controlMerchantMutation } from "./control-merchants.shared.server.ts";

const retrySchema=z.object({jobId:z.string().uuid()});

export const retryControlOperationalJobAction=createServerFn({method:"POST"})
  .validator(retrySchema)
  .handler(async({data})=>{
    const ctx=await controlMerchantMutation();
    const rows=await ctx.sql.query(
      `with retried as (
         update public.operational_jobs
         set status='queued',attempts=0,available_at=now(),last_error=null,
             lease_expires_at=null,locked_by=null,updated_at=now()
         where id=$1::uuid and tenant_id=$2::uuid and status='dead_letter'
         returning id,tenant_id,store_id,kind
       ), audit as (
         insert into public.audit_logs(actor_user_id,tenant_id,store_id,action,resource_type,resource_id,metadata)
         select $3::uuid,tenant_id,store_id,'control.job.retried','operational_job',id::text,
           jsonb_build_object('kind',kind) from retried returning id
       ) select id::text from retried`,
      [data.jobId,ctx.tenantId,ctx.actorUserId],
    );
    if(!rows[0]) throw new Error("Job não encontrado em dead-letter nesta White Label.");
    return {retried:true};
  });
