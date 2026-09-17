export type JobKind =
  | "webhook.process"
  | "email.send"
  | "media.process"
  | "billing.reconcile"
  | "domain.verify";

export interface Job<TPayload = Record<string, unknown>> {
  id: string;
  kind: JobKind;
  payload: TPayload;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
}
