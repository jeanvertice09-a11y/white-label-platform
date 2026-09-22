import type { Campaign, CampaignStatus, Coupon } from "./types.ts";

export type CampaignDisplayStatus = CampaignStatus | "active";
export type CouponDisplayStatus = "inactive" | "scheduled" | "active" | "expired" | "exhausted";

function nowMs(now: Date | string): number {
  return now instanceof Date ? now.getTime() : Date.parse(now);
}

export function getCampaignDisplayStatus(
  campaign: Pick<Campaign, "status" | "scheduledAt">,
  now: Date | string = new Date(),
): CampaignDisplayStatus {
  if (campaign.status !== "scheduled" || !campaign.scheduledAt) return campaign.status;
  return Date.parse(campaign.scheduledAt) <= nowMs(now) ? "active" : "scheduled";
}

export function getCouponDisplayStatus(
  coupon: Pick<Coupon, "active" | "startsAt" | "endsAt" | "usageLimit" | "usageCount">,
  now: Date | string = new Date(),
): CouponDisplayStatus {
  const current = nowMs(now);
  if (!coupon.active) return "inactive";
  if (coupon.startsAt && Date.parse(coupon.startsAt) > current) return "scheduled";
  if (coupon.endsAt && Date.parse(coupon.endsAt) <= current) return "expired";
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) return "exhausted";
  return "active";
}
