export type PlatformSubscriptionAccessStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export interface PlatformAccessSnapshot {
  tenantStatus: "trial" | "active" | "suspended";
  tenantTrialEndsAt: string | null;
  subscriptionStatus: PlatformSubscriptionAccessStatus | null;
  subscriptionTrialEndsAt: string | null;
}

export type PlatformAccessDecision =
  | { allowed: true; source: "tenant_trial" | "subscription" }
  | {
      allowed: false;
      reason:
        | "TENANT_SUSPENDED"
        | "TRIAL_EXPIRED"
        | "SUBSCRIPTION_MISSING"
        | "SUBSCRIPTION_PAST_DUE"
        | "SUBSCRIPTION_CANCELED"
        | "SUBSCRIPTION_EXPIRED";
    };

export function evaluatePlatformAccess(
  snapshot: PlatformAccessSnapshot,
  now = new Date(),
): PlatformAccessDecision {
  if (snapshot.tenantStatus === "suspended") {
    return { allowed: false, reason: "TENANT_SUSPENDED" };
  }
  if (snapshot.tenantStatus === "trial") {
    const end = snapshot.tenantTrialEndsAt
      ? Date.parse(snapshot.tenantTrialEndsAt)
      : Number.NaN;
    if (Number.isFinite(end) && end > now.getTime()) {
      return { allowed: true, source: "tenant_trial" };
    }
  }
  if (snapshot.subscriptionStatus === "active") {
    return { allowed: true, source: "subscription" };
  }
  if (snapshot.subscriptionStatus === "trialing") {
    const end = snapshot.subscriptionTrialEndsAt
      ? Date.parse(snapshot.subscriptionTrialEndsAt)
      : Number.NaN;
    if (Number.isFinite(end) && end > now.getTime()) {
      return { allowed: true, source: "subscription" };
    }
    return { allowed: false, reason: "TRIAL_EXPIRED" };
  }
  if (snapshot.subscriptionStatus === "past_due") {
    return { allowed: false, reason: "SUBSCRIPTION_PAST_DUE" };
  }
  if (snapshot.subscriptionStatus === "canceled") {
    return { allowed: false, reason: "SUBSCRIPTION_CANCELED" };
  }
  if (snapshot.subscriptionStatus === "expired") {
    return { allowed: false, reason: "SUBSCRIPTION_EXPIRED" };
  }
  return {
    allowed: false,
    reason: snapshot.tenantStatus === "trial"
      ? "TRIAL_EXPIRED"
      : "SUBSCRIPTION_MISSING",
  };
}
