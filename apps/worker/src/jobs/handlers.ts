import type { Job } from "./types.ts";

function rejectUnimplemented(kind: Job["kind"]): Promise<void> {
  return Promise.reject(new Error(`Job kind ${kind} is not implemented; refusing fake success.`));
}

export function handleEmailJob(job: Job<{ to: string; subject: string }>): Promise<void> {
  return rejectUnimplemented(job.kind);
}

export function handleMediaJob(job: Job<{ objectKey: string }>): Promise<void> {
  return rejectUnimplemented(job.kind);
}

export function handleBillingJob(job: Job<{ level: string }>): Promise<void> {
  return rejectUnimplemented(job.kind);
}

export function handleDomainVerifyJob(job: Job<{ hostname: string }>): Promise<void> {
  return rejectUnimplemented(job.kind);
}
