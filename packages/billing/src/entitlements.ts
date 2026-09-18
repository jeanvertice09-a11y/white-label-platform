import type {
  EntitlementFailureCode,
  StoreSubscriptionSnapshot,
} from "./commercial-types.ts";

export class EntitlementError extends Error {
  constructor(
    readonly code: EntitlementFailureCode,
    message: string,
  ) {
    super(message);
  }
}

function statusError(
  snapshot: StoreSubscriptionSnapshot | null,
  now: Date,
): EntitlementError | null {
  if (!snapshot) {
    return new EntitlementError("SUBSCRIPTION_MISSING", "Assinatura inexistente");
  }

  if (snapshot.status === "active") return null;
  if (snapshot.status === "trialing") {
    const endsAt = snapshot.trialEndsAt ? Date.parse(snapshot.trialEndsAt) : Number.NaN;
    if (Number.isFinite(endsAt) && endsAt > now.getTime()) return null;
    return new EntitlementError("TRIAL_EXPIRED", "Período de teste expirado");
  }
  if (snapshot.status === "past_due") {
    return new EntitlementError("SUBSCRIPTION_PAST_DUE", "Assinatura com pagamento pendente");
  }
  if (snapshot.status === "suspended") {
    return new EntitlementError("SUBSCRIPTION_SUSPENDED", "Assinatura suspensa");
  }
  if (snapshot.status === "canceled") {
    return new EntitlementError("SUBSCRIPTION_CANCELED", "Assinatura cancelada");
  }
  return new EntitlementError("SUBSCRIPTION_EXPIRED", "Assinatura expirada");
}

export function assertSubscriptionAccess(
  snapshot: StoreSubscriptionSnapshot | null,
  now = new Date(),
): StoreSubscriptionSnapshot {
  const error = statusError(snapshot, now);
  if (error) throw error;
  if (!snapshot) throw new EntitlementError("SUBSCRIPTION_MISSING", "Assinatura inexistente");
  return snapshot;
}

export function hasFeature(
  snapshot: StoreSubscriptionSnapshot | null,
  featureKey: string,
  now = new Date(),
): boolean {
  try {
    const active = assertSubscriptionAccess(snapshot, now);
    return active.features[featureKey] === true;
  } catch (error) {
    if (error instanceof EntitlementError) return false;
    throw error;
  }
}

export function getLimit(
  snapshot: StoreSubscriptionSnapshot | null,
  limitKey: string,
  now = new Date(),
): number | null {
  try {
    const active = assertSubscriptionAccess(snapshot, now);
    const value = active.limits[limitKey];
    return value === undefined ? null : value;
  } catch (error) {
    if (error instanceof EntitlementError) return null;
    throw error;
  }
}

export function assertFeature(
  snapshot: StoreSubscriptionSnapshot | null,
  featureKey: string,
  now = new Date(),
): void {
  const active = assertSubscriptionAccess(snapshot, now);
  if (active.features[featureKey] !== true) {
    throw new EntitlementError(
      "FEATURE_NOT_INCLUDED",
      `Recurso não incluído no plano: ${featureKey}`,
    );
  }
}

export function assertWithinLimit(
  snapshot: StoreSubscriptionSnapshot | null,
  limitKey: string,
  currentUsage: number,
  increment = 1,
  now = new Date(),
): void {
  const active = assertSubscriptionAccess(snapshot, now);
  const limit = active.limits[limitKey];
  if (limit === undefined) {
    throw new EntitlementError("LIMIT_NOT_INCLUDED", `Limite não incluído no plano: ${limitKey}`);
  }
  if (!Number.isInteger(currentUsage) || currentUsage < 0 || !Number.isInteger(increment) || increment < 0) {
    throw new Error("Uso de limite inválido");
  }
  if (currentUsage + increment > limit) {
    throw new EntitlementError(
      "LIMIT_REACHED",
      `Limite atingido para ${limitKey}: ${String(currentUsage)}/${String(limit)}`,
    );
  }
}
