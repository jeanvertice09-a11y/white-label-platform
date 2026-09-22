import { describe, expect, test } from "bun:test";
import { getCampaignDisplayStatus, getCouponDisplayStatus } from "@white-label/marketing";

describe("marketing temporal presentation", () => {
  test("campanha agendada vira ativa quando o horário é atingido", () => {
    expect(getCampaignDisplayStatus({ status: "scheduled", scheduledAt: "2026-09-22T10:00:00.000Z" }, "2026-09-22T09:59:00.000Z")).toBe("scheduled");
    expect(getCampaignDisplayStatus({ status: "scheduled", scheduledAt: "2026-09-22T10:00:00.000Z" }, "2026-09-22T10:00:00.000Z")).toBe("active");
    expect(getCampaignDisplayStatus({ status: "cancelled", scheduledAt: "2026-09-22T10:00:00.000Z" }, "2026-09-23T10:00:00.000Z")).toBe("cancelled");
  });

  test("cupom deriva agendado, expirado, esgotado e ativo sem alterar cálculo comercial", () => {
    const base = { active: true, startsAt: null, endsAt: null, usageLimit: null, usageCount: 0 };
    expect(getCouponDisplayStatus({ ...base, startsAt: "2026-09-22T10:00:00.000Z" }, "2026-09-22T09:00:00.000Z")).toBe("scheduled");
    expect(getCouponDisplayStatus({ ...base, endsAt: "2026-09-22T10:00:00.000Z" }, "2026-09-22T10:00:00.000Z")).toBe("expired");
    expect(getCouponDisplayStatus({ ...base, usageLimit: 10, usageCount: 10 }, "2026-09-22T09:00:00.000Z")).toBe("exhausted");
    expect(getCouponDisplayStatus(base, "2026-09-22T09:00:00.000Z")).toBe("active");
    expect(getCouponDisplayStatus({ ...base, active: false }, "2026-09-22T09:00:00.000Z")).toBe("inactive");
  });
});
