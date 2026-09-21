import type { PublicStoreProfile } from "./types.ts";

export const EMPTY_PUBLIC_STORE_PROFILE: PublicStoreProfile = {
  description: null,
  phone: null,
  publicEmail: null,
  address: null,
  instagram: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

export function readPublicStoreProfile(settings: unknown): PublicStoreProfile {
  const record = asRecord(settings);
  if (!record) return { ...EMPTY_PUBLIC_STORE_PROFILE };
  const instagram = text(record["instagram"], 31);
  return {
    description: text(record["description"], 1000),
    phone: text(record["phone"], 30),
    publicEmail: text(record["public_email"], 254),
    address: text(record["address"], 500),
    instagram: instagram?.replace(/^@/, "") ?? null,
  };
}
