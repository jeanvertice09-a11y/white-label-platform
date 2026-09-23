export type JobKind =
  | "email.send"
  | "media.process"
  | "billing.reconcile"
  | "domain.verify"
  | "store_payment.reconcile"
  | "shipment.recover";

export interface OperationalJob {
  id: string;
  tenantId: string | null;
  storeId: string | null;
  kind: JobKind;
  payloadVersion: 1;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

export interface EnqueueJob {
  tenantId?: string | null;
  storeId?: string | null;
  kind: JobKind;
  payloadVersion?: 1;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  maxAttempts?: number;
}
