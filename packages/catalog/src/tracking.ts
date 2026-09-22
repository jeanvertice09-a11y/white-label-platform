import type { CatalogSettings } from "./types.ts";

export interface CatalogTrackingSettings {
  metaPixelId: string | null;
  ga4MeasurementId: string | null;
  tiktokPixelId: string | null;
}

export const CATALOG_TRACKING_LABEL_KEYS = [
  "tracking_meta_pixel_id",
  "tracking_ga4_measurement_id",
  "tracking_tiktok_pixel_id",
] as const;

const META_PIXEL_ID = /^\d{5,32}$/;
const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/i;
const TIKTOK_PIXEL_ID = /^[A-Z0-9]{5,40}$/i;

function readTrackingId(
  labels: Record<string, string>,
  key: string,
  pattern: RegExp,
): string | null {
  const entry = Object.entries(labels).find(([entryKey]) => entryKey === key);
  const value = entry ? entry[1].trim() : "";
  return value && pattern.test(value) ? value : null;
}

export function getCatalogTrackingSettings(
  settings: Pick<CatalogSettings, "labels">,
): CatalogTrackingSettings {
  return {
    metaPixelId: readTrackingId(settings.labels, "tracking_meta_pixel_id", META_PIXEL_ID),
    ga4MeasurementId: readTrackingId(settings.labels, "tracking_ga4_measurement_id", GA4_MEASUREMENT_ID),
    tiktokPixelId: readTrackingId(settings.labels, "tracking_tiktok_pixel_id", TIKTOK_PIXEL_ID),
  };
}

function writeTrackingId(
  labels: Record<string, string>,
  key: string,
  value: string | null,
): Record<string, string> {
  const next = Object.fromEntries(Object.entries(labels).filter(([entryKey]) => entryKey !== key));
  const normalized = value?.trim() ?? "";
  if (normalized) next[key] = normalized;
  return next;
}

export function mergeCatalogTrackingLabels(
  labels: Record<string, string>,
  settings: CatalogTrackingSettings,
): Record<string, string> {
  let next = writeTrackingId(labels, "tracking_meta_pixel_id", settings.metaPixelId);
  next = writeTrackingId(next, "tracking_ga4_measurement_id", settings.ga4MeasurementId);
  return writeTrackingId(next, "tracking_tiktok_pixel_id", settings.tiktokPixelId);
}
