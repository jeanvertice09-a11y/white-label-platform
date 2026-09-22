import type {
  CatalogMerchandising,
  PublicCatalogMerchandising,
} from "./types.ts";

const PROMO_KEYS = [
  "promo.enabled",
  "promo.text",
  "promo.href",
  "promo.startsAt",
  "promo.endsAt",
  "promo.countdown",
] as const;
const PROMO_KEY_SET = new Set<string>(PROMO_KEYS);

export const CATALOG_MERCHANDISING_LABEL_KEYS = PROMO_KEYS;

function recordFrom(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function iso(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function isSafePromotionalHref(value: string): boolean {
  const href = value.trim();
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try {
    return new URL(href).protocol === "https:";
  } catch {
    return false;
  }
}

export function readCatalogMerchandising(labels: unknown): CatalogMerchandising {
  const source = recordFrom(labels);
  const rawHref = text(source["promo.href"]);
  return {
    enabled: source["promo.enabled"] === "true",
    text: text(source["promo.text"]) ?? "",
    href: rawHref && isSafePromotionalHref(rawHref) ? rawHref : null,
    startsAt: iso(source["promo.startsAt"]),
    endsAt: iso(source["promo.endsAt"]),
    countdown: source["promo.countdown"] === "true",
  };
}

export function mergeCatalogMerchandisingLabels(
  labels: Record<string, string>,
  merchandising: CatalogMerchandising,
): Record<string, string> {
  const next = Object.fromEntries(
    Object.entries(labels).filter(([key]) => !PROMO_KEY_SET.has(key)),
  );
  next["promo.enabled"] = merchandising.enabled ? "true" : "false";
  if (merchandising.text.trim()) next["promo.text"] = merchandising.text.trim();
  if (merchandising.href) next["promo.href"] = merchandising.href.trim();
  if (merchandising.startsAt) next["promo.startsAt"] = merchandising.startsAt;
  if (merchandising.endsAt) next["promo.endsAt"] = merchandising.endsAt;
  next["promo.countdown"] = merchandising.countdown ? "true" : "false";
  return next;
}

export function resolvePublicCatalogMerchandising(
  labels: unknown,
  now: Date = new Date(),
): PublicCatalogMerchandising | null {
  const merchandising = readCatalogMerchandising(labels);
  const nowMs = now.getTime();
  if (!merchandising.enabled || !merchandising.text) return null;
  if (merchandising.startsAt && Date.parse(merchandising.startsAt) > nowMs) return null;
  if (merchandising.endsAt && Date.parse(merchandising.endsAt) <= nowMs) return null;
  return {
    text: merchandising.text,
    href: merchandising.href,
    endsAt: merchandising.endsAt,
    countdown: merchandising.countdown && merchandising.endsAt !== null,
    serverNow: now.toISOString(),
  };
}

export function hasPromotionalPrice(
  priceCents: number,
  compareAtPriceCents: number | null,
): boolean {
  return compareAtPriceCents !== null && compareAtPriceCents > priceCents;
}
