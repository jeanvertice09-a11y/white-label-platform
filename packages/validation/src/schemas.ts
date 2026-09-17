import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug inválido");

export const hostnameInputSchema = z.string().min(1).max(253);

function envString(optional = false) {
  return optional ? z.string().optional() : z.string().min(1);
}

// Env pública (VITE_*): jamais contém segredo.
export const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(10),
  VITE_APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

// Env privada server-side. Service role e segredos ficam aqui.
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  R2_ACCOUNT_ID: envString(true),
  R2_ACCESS_KEY_ID: envString(true),
  R2_SECRET_ACCESS_KEY: envString(true),
  R2_BUCKET_MEDIA: envString(true),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parsePublicEnv(raw: unknown): PublicEnv {
  return publicEnvSchema.parse(raw);
}

export function parseServerEnv(raw: unknown): ServerEnv {
  return serverEnvSchema.parse(raw);
}
