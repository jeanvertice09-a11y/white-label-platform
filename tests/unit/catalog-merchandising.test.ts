import { describe, expect, test } from "bun:test";
import {
  hasPromotionalPrice,
  isSafePromotionalHref,
  mergeCatalogMerchandisingLabels,
  readCatalogMerchandising,
  resolvePublicCatalogMerchandising,
} from "@white-label/catalog";

describe("catalog merchandising", () => {
  test("preserva labels não promocionais e faz roundtrip da configuração", () => {
    const labels = mergeCatalogMerchandisingLabels({ subtitle: "Minha loja" }, {
      enabled: true,
      text: "Semana de ofertas",
      href: "/categoria/ofertas",
      startsAt: "2026-09-20T10:00:00.000Z",
      endsAt: "2026-09-25T10:00:00.000Z",
      countdown: true,
    });
    expect(labels["subtitle"]).toBe("Minha loja");
    expect(readCatalogMerchandising(labels)).toEqual({
      enabled: true,
      text: "Semana de ofertas",
      href: "/categoria/ofertas",
      startsAt: "2026-09-20T10:00:00.000Z",
      endsAt: "2026-09-25T10:00:00.000Z",
      countdown: true,
    });
  });

  test("só publica barra dentro da janela configurada", () => {
    const labels = mergeCatalogMerchandisingLabels({}, {
      enabled: true, text: "Oferta", href: null,
      startsAt: "2026-09-21T10:00:00.000Z", endsAt: "2026-09-21T12:00:00.000Z", countdown: true,
    });
    expect(resolvePublicCatalogMerchandising(labels, new Date("2026-09-21T09:59:59.000Z"))).toBeNull();
    const active = resolvePublicCatalogMerchandising(labels, new Date("2026-09-21T11:00:00.000Z"));
    expect(active?.text).toBe("Oferta");
    expect(active?.countdown).toBe(true);
    expect(active?.serverNow).toBe("2026-09-21T11:00:00.000Z");
    expect(resolvePublicCatalogMerchandising(labels, new Date("2026-09-21T12:00:00.000Z"))).toBeNull();
  });

  test("rejeita links inseguros e usa compare-at real para badge", () => {
    expect(isSafePromotionalHref("/ofertas")).toBe(true);
    expect(isSafePromotionalHref("https://example.com/ofertas")).toBe(true);
    expect(isSafePromotionalHref("javascript:alert(1)")).toBe(false);
    expect(isSafePromotionalHref("//evil.example")).toBe(false);
    expect(hasPromotionalPrice(1_299, 1_399)).toBe(true);
    expect(hasPromotionalPrice(1_399, 1_399)).toBe(false);
    expect(hasPromotionalPrice(1_399, null)).toBe(false);
  });
});
