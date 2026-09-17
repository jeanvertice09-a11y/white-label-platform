import type { Job } from "./types.ts";

export async function handleEmailJob(job: Job<{ to: string; subject: string }>): Promise<void> {
  await Promise.resolve(job);
}

export async function handleMediaJob(job: Job<{ objectKey: string }>): Promise<void> {
  await Promise.resolve(job);
}

export async function handleBillingJob(job: Job<{ level: string }>): Promise<void> {
  await Promise.resolve(job);
}

export async function handleDomainVerifyJob(job: Job<{ hostname: string }>): Promise<void> {
  await Promise.resolve(job);
}
